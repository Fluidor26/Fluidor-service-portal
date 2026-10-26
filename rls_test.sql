-- Test: rechten per klant. Draait na migratie + seed. Elke fout breekt het script af.
\set ON_ERROR_STOP on
insert into auth.users values
 ('00000000-0000-4000-8000-0000000000f1','coord@fluidor.com','{"full_name":"Servicecoördinator"}'),
 ('00000000-0000-4000-8000-0000000000a1','jan@noordhoeve.nl','{"full_name":"J. de Vries","role":"klant_beheerder","customer_id":"11111111-1111-4111-8111-111111111111"}'),
 ('00000000-0000-4000-8000-0000000000b1','sanne@vandijk.nl','{"full_name":"S. Bakker","role":"klant_gebruiker","customer_id":"22222222-2222-4222-8222-222222222222"}'),
 ('00000000-0000-4000-8000-0000000000e1','iemand@gmail.com','{}');
update public.profiles set role='coordinator' where email='coord@fluidor.com';

do $$ begin
  assert (select role from public.profiles where email='coord@fluidor.com')='coordinator';
  assert (select role from public.profiles where email='iemand@gmail.com')='geen', 'onbekende gebruiker krijgt geen toegang';
end $$;

-- ===== Klant A =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  assert (select count(*) from public.customers)=1, 'klant A ziet 1 klant';
  assert (select count(*) from public.machines)=2, 'klant A ziet 2 machines';
  assert (select count(*) from public.components where customer_id <> '11111111-1111-4111-8111-111111111111')=0;
end $$;
-- ticket op eigen machine mag
insert into public.tickets (machine_id, type, priority, title, description, created_by)
values ('c1111111-0000-4000-8000-000000000001','storing',4,'Pomp slaat af','E-214 op HMI','00000000-0000-4000-8000-0000000000a1');
-- ticket op machine van klant B moet geweigerd worden
do $$ begin
  begin
    insert into public.tickets (machine_id, type, title, description, created_by)
    values ('c2222222-0000-4000-8000-000000000001','vraag','Hack','x','00000000-0000-4000-8000-0000000000a1');
    raise exception 'FOUT: ticket op andere klant toegestaan';
  exception when insufficient_privilege then null; end;
  -- klant mag geen status zetten bij aanmaken
  begin
    insert into public.tickets (machine_id, type, title, description, created_by, status)
    values ('c1111111-0000-4000-8000-000000000001','vraag','Test','x','00000000-0000-4000-8000-0000000000a1','opgelost');
    raise exception 'FOUT: klant kon status zetten';
  exception when insufficient_privilege then null; end;
  -- klant mag geen tickets wijzigen
  update public.tickets set status='opgelost';
  assert (select count(*) from public.tickets where status='opgelost')=0, 'klant kon ticket wijzigen';
  -- klant mag niet als iemand anders schrijven
  begin
    insert into public.ticket_messages (ticket_id, author_id, body)
    select id, '00000000-0000-4000-8000-0000000000f1', 'nep' from public.tickets limit 1;
    raise exception 'FOUT: bericht namens ander toegestaan';
  exception when insufficient_privilege then null; end;
  -- klant mag zijn rol niet aanpassen
  update public.profiles set role='beheerder' where id = auth.uid();
end $$;
reset role;
do $$ begin
  assert (select role from public.profiles where email='jan@noordhoeve.nl')='klant_beheerder', 'klant kon eigen rol wijzigen';
  assert (select number from public.tickets limit 1) like 'SR-____-00001';
end $$;

-- ===== Medewerker =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f1';
do $$ begin
  assert (select count(*) from public.customers)=3;
  assert (select count(*) from public.ticket_overview)=1;
end $$;
insert into public.documents (machine_id, title, visibility, storage_path, file_name)
values ('c1111111-0000-4000-8000-000000000001','Handleiding 612-FE-2022','extern','x/handleiding.pdf','handleiding.pdf'),
       ('c1111111-0000-4000-8000-000000000001','Interne risicoanalyse','intern','x/risico.pdf','risico.pdf');
insert into public.internal_notes (entity, entity_id, body) values ('machine','c1111111-0000-4000-8000-000000000001','Klant is prijsgevoelig');
insert into storage.objects (bucket_id, name) values ('documenten','x/handleiding.pdf'),('documenten','x/risico.pdf');
update public.tickets set status='wacht_op_klant', assignee_id='00000000-0000-4000-8000-0000000000f1';
insert into public.ticket_messages (ticket_id, author_id, kind, body)
select id, auth.uid(), 'bericht', 'Kunt u een foto van het typeplaatje sturen?' from public.tickets;
insert into public.ticket_messages (ticket_id, author_id, kind, body)
select id, auth.uid(), 'intern', 'Vermoedelijk thermisch relais, onderdeel op voorraad.' from public.tickets;
do $$ begin
  assert (select count(*) from public.ticket_messages where kind='systeem')=2, 'systeemberichten status + toewijzing';
  assert (select first_response_at is not null from public.tickets), 'eerste reactie vastgelegd';
end $$;
reset role;

-- ===== Klant A reageert =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';
insert into public.ticket_messages (ticket_id, author_id, body)
select id, auth.uid(), 'Foto volgt per mail.' from public.tickets;
do $$ begin
  assert (select status from public.tickets)='in_behandeling', 'reactie klant zet status terug';
  assert (select count(*) from public.ticket_messages where kind='intern')=0, 'klant ziet interne notitie';
  assert (select count(*) from public.documents)=1, 'klant ziet alleen extern document';
  assert (select count(*) from storage.objects)=1, 'klant kan alleen extern bestand openen';
  assert (select assignee_name from public.ticket_overview) = 'Servicecoördinator', 'klant ziet naam behandelaar';
  assert (select count(*) from public.people where not is_staff)=1, 'klant ziet alleen eigen collega';
  assert (select count(*) from public.audit_log)=0, 'klant leest geen auditlog';
  assert (select count(*) from public.internal_notes)=0, 'klant leest geen interne notities';
end $$;
reset role;

-- ===== Klant B =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000b1';
do $$ begin
  assert (select count(*) from public.tickets)=0, 'klant B ziet ticket van klant A';
  assert (select count(*) from public.ticket_messages)=0;
  assert (select count(*) from public.documents)=0;
  assert (select count(*) from public.machines)=1;
  assert (select count(*) from public.people where not is_staff)=1;
end $$;
reset role;

-- ===== Geen rol =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000e1';
do $$ begin
  assert (select count(*) from public.customers)=0;
  assert (select count(*) from public.machines)=0;
  assert (select count(*) from public.tickets)=0;
end $$;
reset role;

select 'ALLE RECHTENTESTS GESLAAGD' as resultaat, (select count(*) from public.audit_log) as auditregels;
