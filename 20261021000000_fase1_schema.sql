-- =====================================================================
-- Fluidor Service Portal — fase 1
-- Schema, rechten per klant (row-level security), triggers en opslag.
--
-- Uitgangspunt: elke tabel met klantgegevens heeft een customer_id.
-- Medewerkers van Fluidor zien alles; een klantgebruiker ziet alleen
-- rijen van de eigen klant. Dit wordt afgedwongen in de database,
-- dus ook een fout in de webapp kan geen gegevens van andere klanten tonen.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Instellingen
-- ---------------------------------------------------------------------
create table public.app_settings (
  key   text primary key,
  value text not null
);
comment on table public.app_settings is 'Algemene instellingen, bijv. het e-maildomein van medewerkers.';

insert into public.app_settings (key, value) values
  ('staff_email_domain', 'fluidor.com');

-- ---------------------------------------------------------------------
-- Klanten en installed base
-- ---------------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  city          text,
  erp_number    text unique,               -- debiteurnummer in Trimergo
  contract      text not null default 'geen' check (contract in ('geen','service_maintenance_plan')),
  created_at    timestamptz not null default now()
);

create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  name         text not null,
  address      text,
  created_at   timestamptz not null default now()
);

create table public.production_lines (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  location_id  uuid references public.locations(id) on delete set null,
  name         text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create table public.machines (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  location_id     uuid references public.locations(id) on delete set null,
  line_id         uuid references public.production_lines(id) on delete set null,
  project_number  text not null unique,    -- bijv. 680-FE-2025
  serial_number   text,
  name            text not null,
  machine_type    text,
  delivered_on    date,
  contract_start  date,                    -- start Service & Maintenance Plan (null = geen contract)
  next_service_on date,
  created_at      timestamptz not null default now()
);
create index on public.machines (customer_id);

create table public.components (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  machine_id      uuid not null references public.machines(id) on delete cascade,
  article_number  text,
  description     text not null,
  quantity        numeric not null default 1,
  is_spare_part   boolean not null default false,
  created_at      timestamptz not null default now()
);
create index on public.components (machine_id);

-- Interne notities bij een klant of machine: nooit zichtbaar voor klanten.
create table public.internal_notes (
  entity      text not null check (entity in ('customer','machine')),
  entity_id   uuid not null,
  body        text not null default '',
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  primary key (entity, entity_id)
);

-- ---------------------------------------------------------------------
-- Gebruikers
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  role         text not null default 'geen' check (role in
                 ('beheerder','coordinator','monteur','medewerker',   -- Fluidor
                  'klant_beheerder','klant_gebruiker',               -- klant
                  'geen')),                                          -- nog geen toegang
  customer_id  uuid references public.customers(id) on delete cascade,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint klantrol_heeft_klant check (
    (role in ('klant_beheerder','klant_gebruiker')) = (customer_id is not null)
  )
);

-- ---------------------------------------------------------------------
-- Documenten
-- ---------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  machine_id    uuid not null references public.machines(id) on delete cascade,
  title         text not null,
  category      text not null default 'handleiding' check (category in
                  ('handleiding','tekening','schema','stuklijst','servicerapport','certificaat','overig')),
  revision      text,
  visibility    text not null default 'intern' check (visibility in ('intern','extern')),
  storage_path  text not null unique,
  file_name     text not null,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.documents (machine_id);

-- ---------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------
create sequence public.ticket_number_seq;

create table public.tickets (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique
                       default 'SR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ticket_number_seq')::text, 5, '0'),
  customer_id        uuid not null references public.customers(id) on delete cascade,
  machine_id         uuid not null references public.machines(id) on delete restrict,
  type               text not null check (type in ('storing','onderhoud','onderdelen','vraag')),
  priority           smallint not null default 2 check (priority between 1 and 4),  -- 4 = machine staat stil
  title              text not null check (length(title) between 3 and 160),
  description        text not null,
  contact_name       text,
  contact_phone      text,
  status             text not null default 'nieuw' check (status in
                       ('nieuw','in_behandeling','ingepland','wacht_op_klant','opgelost')),
  assignee_id        uuid references public.profiles(id) on delete set null,
  planned_on         date,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  first_response_at  timestamptz,
  resolved_at        timestamptz
);
create index on public.tickets (customer_id, status);
create index on public.tickets (machine_id);

create table public.ticket_messages (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.tickets(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  kind         text not null default 'bericht' check (kind in ('bericht','intern','systeem')),
  body         text not null check (length(body) > 0),
  created_at   timestamptz not null default now()
);
create index on public.ticket_messages (ticket_id, created_at);

-- ---------------------------------------------------------------------
-- Auditlog (ISO 27001 / NIS2): wie deed wat en wanneer
-- ---------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- Hulpfuncties voor rechten
-- security definer: ze lezen profiles zonder zelf door RLS geblokkeerd te worden.
-- =====================================================================
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
      and role in ('beheerder','coordinator','monteur','medewerker')
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active and role in ('beheerder','coordinator')
  );
$$;

create or replace function public.my_customer() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from public.profiles
  where id = auth.uid() and active and role in ('klant_beheerder','klant_gebruiker');
$$;

-- =====================================================================
-- Triggers
-- =====================================================================

-- Nieuwe login → profiel. Medewerkers herkend aan e-maildomein,
-- klanten aan de gegevens die bij de uitnodiging zijn meegegeven.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  staff_domain text := (select value from public.app_settings where key = 'staff_email_domain');
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := 'geen';
  v_customer uuid := null;
begin
  if meta ? 'customer_id' and meta->>'role' in ('klant_beheerder','klant_gebruiker') then
    v_role := meta->>'role';
    v_customer := (meta->>'customer_id')::uuid;
  elsif lower(split_part(new.email, '@', 2)) = lower(staff_domain) then
    v_role := 'medewerker';
  end if;

  insert into public.profiles (id, email, full_name, role, customer_id)
  values (new.id, new.email,
          coalesce(meta->>'full_name', meta->>'name', split_part(new.email, '@', 1)),
          v_role, v_customer)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- customer_id altijd overnemen van de bovenliggende machine/ticket,
-- zodat niemand een rij aan een andere klant kan koppelen.
create or replace function public.inherit_customer_from_machine() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select customer_id into new.customer_id from public.machines where id = new.machine_id;
  if new.customer_id is null then
    raise exception 'Onbekende machine';
  end if;
  return new;
end $$;

create trigger components_customer before insert or update of machine_id on public.components
  for each row execute function public.inherit_customer_from_machine();
create trigger documents_customer before insert or update of machine_id on public.documents
  for each row execute function public.inherit_customer_from_machine();
create trigger tickets_customer before insert or update of machine_id on public.tickets
  for each row execute function public.inherit_customer_from_machine();

create or replace function public.inherit_customer_from_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select customer_id into new.customer_id from public.tickets where id = new.ticket_id;
  return new;
end $$;

create trigger messages_customer before insert on public.ticket_messages
  for each row execute function public.inherit_customer_from_ticket();

-- Machine moet bij dezelfde klant horen als locatie/lijn.
create or replace function public.check_machine_links() returns trigger
language plpgsql as $$
begin
  if new.location_id is not null and not exists
     (select 1 from public.locations where id = new.location_id and customer_id = new.customer_id) then
    raise exception 'Locatie hoort niet bij deze klant';
  end if;
  if new.line_id is not null and not exists
     (select 1 from public.production_lines where id = new.line_id and customer_id = new.customer_id) then
    raise exception 'Productielijn hoort niet bij deze klant';
  end if;
  return new;
end $$;

create trigger machines_links before insert or update on public.machines
  for each row execute function public.check_machine_links();

-- Ticketwijzigingen: tijdstempels, systeemberichten en audit.
create or replace function public.ticket_before_update() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'opgelost' and old.status <> 'opgelost' then
    new.resolved_at := now();
  elsif new.status <> 'opgelost' then
    new.resolved_at := null;
  end if;
  return new;
end $$;

create trigger tickets_before_update before update on public.tickets
  for each row execute function public.ticket_before_update();

create or replace function public.status_label(s text) returns text
language sql immutable as $$
  select case s
    when 'nieuw' then 'Nieuw'
    when 'in_behandeling' then 'In behandeling'
    when 'ingepland' then 'Ingepland'
    when 'wacht_op_klant' then 'Wacht op klant'
    when 'opgelost' then 'Opgelost'
    else s end;
$$;

create or replace function public.ticket_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  assignee_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'aangemaakt', 'ticket', new.id,
            jsonb_build_object('number', new.number, 'priority', new.priority));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.ticket_messages (ticket_id, customer_id, author_id, kind, body)
    values (new.id, new.customer_id, auth.uid(), 'systeem',
            'Status gewijzigd van "' || public.status_label(old.status) || '" naar "' || public.status_label(new.status) || '".');
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    select full_name into assignee_name from public.profiles where id = new.assignee_id;
    insert into public.ticket_messages (ticket_id, customer_id, author_id, kind, body)
    values (new.id, new.customer_id, auth.uid(), 'systeem',
            case when new.assignee_id is null then 'Toewijzing verwijderd.'
                 else 'Toegewezen aan ' || coalesce(assignee_name, 'een medewerker') || '.' end);
  end if;
  if new.planned_on is distinct from old.planned_on and new.planned_on is not null then
    insert into public.ticket_messages (ticket_id, customer_id, author_id, kind, body)
    values (new.id, new.customer_id, auth.uid(), 'systeem',
            'Ingepland op ' || to_char(new.planned_on, 'DD-MM-YYYY') || '.');
  end if;

  if (new.status, new.assignee_id, new.priority, new.planned_on)
     is not distinct from (old.status, old.assignee_id, old.priority, old.planned_on) then
    return new;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'gewijzigd', 'ticket', new.id,
          jsonb_build_object('status', jsonb_build_array(old.status, new.status),
                             'assignee', jsonb_build_array(old.assignee_id, new.assignee_id),
                             'priority', jsonb_build_array(old.priority, new.priority)));
  return new;
end $$;

create trigger tickets_after_change after insert or update on public.tickets
  for each row execute function public.ticket_after_change();

-- Nieuw bericht: eerste reactie van Fluidor vastleggen (KPI reactietijd)
-- en een reactie van de klant zet "Wacht op klant" terug naar "In behandeling".
create or replace function public.message_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  author_is_staff boolean;
begin
  if new.kind = 'systeem' then
    return new;
  end if;
  select role in ('beheerder','coordinator','monteur','medewerker') into author_is_staff
  from public.profiles where id = new.author_id;

  if coalesce(author_is_staff, false) then
    update public.tickets set first_response_at = coalesce(first_response_at, now()), updated_at = now()
    where id = new.ticket_id and new.kind = 'bericht';
    update public.tickets set updated_at = now() where id = new.ticket_id and new.kind = 'intern';
  else
    update public.tickets
       set status = case when status = 'wacht_op_klant' then 'in_behandeling' else status end,
           updated_at = now()
     where id = new.ticket_id;
  end if;
  return new;
end $$;

create trigger messages_after_insert after insert on public.ticket_messages
  for each row execute function public.message_after_insert();

-- Profielwijzigingen loggen (rol of toegang aangepast).
create or replace function public.profile_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role or new.active is distinct from old.active
     or new.customer_id is distinct from old.customer_id then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'rechten gewijzigd', 'profiel', new.id,
            jsonb_build_object('role', jsonb_build_array(old.role, new.role),
                               'active', jsonb_build_array(old.active, new.active)));
  end if;
  return new;
end $$;

create trigger profiles_audit after update on public.profiles
  for each row execute function public.profile_audit();

-- =====================================================================
-- Row-level security
-- =====================================================================
alter table public.app_settings      enable row level security;
alter table public.customers         enable row level security;
alter table public.locations         enable row level security;
alter table public.production_lines  enable row level security;
alter table public.machines          enable row level security;
alter table public.components        enable row level security;
alter table public.profiles          enable row level security;
alter table public.documents         enable row level security;
alter table public.tickets           enable row level security;
alter table public.ticket_messages   enable row level security;
alter table public.audit_log         enable row level security;
alter table public.internal_notes    enable row level security;

-- Instellingen: alleen beheer
create policy settings_admin on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- Klant en installed base: lezen eigen klant of medewerker; schrijven alleen medewerkers
create policy customers_read on public.customers for select
  using (public.is_staff() or id = public.my_customer());
create policy customers_write on public.customers for all
  using (public.is_admin()) with check (public.is_admin());

create policy locations_read on public.locations for select
  using (public.is_staff() or customer_id = public.my_customer());
create policy locations_write on public.locations for all
  using (public.is_staff()) with check (public.is_staff());

create policy lines_read on public.production_lines for select
  using (public.is_staff() or customer_id = public.my_customer());
create policy lines_write on public.production_lines for all
  using (public.is_staff()) with check (public.is_staff());

create policy machines_read on public.machines for select
  using (public.is_staff() or customer_id = public.my_customer());
create policy machines_write on public.machines for all
  using (public.is_staff()) with check (public.is_staff());

create policy components_read on public.components for select
  using (public.is_staff() or customer_id = public.my_customer());
create policy components_write on public.components for all
  using (public.is_staff()) with check (public.is_staff());

-- Documenten: klant ziet alleen externe documenten van de eigen klant
create policy documents_read on public.documents for select
  using (public.is_staff() or (customer_id = public.my_customer() and visibility = 'extern'));
create policy documents_write on public.documents for all
  using (public.is_staff()) with check (public.is_staff());

-- Profielen: eigen profiel, collega's van dezelfde klant, medewerkers alles.
-- Wijzigen alleen door beheer (rol en klant kan een gebruiker niet zelf aanpassen).
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_staff()
         or (customer_id is not null and customer_id = public.my_customer()));
create policy profiles_admin_write on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- Tickets
create policy tickets_read on public.tickets for select
  using (public.is_staff() or customer_id = public.my_customer());
create policy tickets_staff_insert on public.tickets for insert
  with check (public.is_staff());
create policy tickets_customer_insert on public.tickets for insert
  with check (
    customer_id = public.my_customer()
    and created_by = auth.uid()
    and status = 'nieuw'
    and assignee_id is null
    and planned_on is null
    and first_response_at is null
    and resolved_at is null
  );
create policy tickets_staff_update on public.tickets for update
  using (public.is_staff()) with check (public.is_staff());

-- Berichten: klant ziet geen interne notities
create policy messages_read on public.ticket_messages for select
  using (public.is_staff() or (customer_id = public.my_customer() and kind <> 'intern'));
create policy messages_staff_insert on public.ticket_messages for insert
  with check (public.is_staff() and author_id = auth.uid() and kind in ('bericht','intern'));
create policy messages_customer_insert on public.ticket_messages for insert
  with check (
    author_id = auth.uid() and kind = 'bericht'
    and exists (select 1 from public.tickets t
                where t.id = ticket_id and t.customer_id = public.my_customer())
  );

-- Interne notities: alleen medewerkers
create policy internal_notes_staff on public.internal_notes for all
  using (public.is_staff()) with check (public.is_staff());

-- Auditlog: alleen beheer leest; schrijven gebeurt via triggers
create policy audit_read on public.audit_log for select using (public.is_admin());

-- Rechten op tabellen voor ingelogde gebruikers (RLS bepaalt welke rijen)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;

-- =====================================================================
-- Bestandsopslag (Supabase Storage): bucket "documenten", privé.
-- Een bestand is leesbaar als de gebruiker het bijbehorende document mag zien.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('documenten', 'documenten', false)
on conflict (id) do nothing;

create policy documenten_lezen on storage.objects for select
  using (bucket_id = 'documenten'
         and exists (select 1 from public.documents d where d.storage_path = storage.objects.name));
create policy documenten_uploaden on storage.objects for insert
  with check (bucket_id = 'documenten' and public.is_staff());
create policy documenten_verwijderen on storage.objects for delete
  using (bucket_id = 'documenten' and public.is_staff());

-- =====================================================================
-- Namen van personen tonen zonder e-mailadressen of andere klanten prijs te geven.
-- Een klant ziet namen van Fluidor-medewerkers en van eigen collega's.
-- =====================================================================
create view public.people as
select p.id, p.full_name,
       p.role in ('beheerder','coordinator','monteur','medewerker') as is_staff
from public.profiles p
where public.is_staff()
   or p.role in ('beheerder','coordinator','monteur','medewerker')
   or (p.customer_id is not null and p.customer_id = public.my_customer());

grant select on public.people to authenticated;

-- =====================================================================
-- Overzicht voor KPI's (respecteert RLS via security_invoker)
-- =====================================================================
create view public.ticket_overview with (security_invoker = true) as
select t.*,
       c.name  as customer_name,
       m.project_number,
       m.name  as machine_name,
       m.serial_number,
       p.full_name as assignee_name
from public.tickets t
join public.customers c on c.id = t.customer_id
join public.machines  m on m.id = t.machine_id
left join public.people p on p.id = t.assignee_id;

grant select on public.ticket_overview to authenticated;
