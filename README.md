# Fluidor Service Portal — fase 1

Eigen webapplicatie voor service bij Fluidor Equipment B.V.: klantportaal, servicetickets en installed base.
Gebouwd volgens het document *Fluidor Service Portal – Functioneel en technisch ontwerp* (fase 1).

## Wat zit erin

| Voor wie | Functie |
| --- | --- |
| Klant | Inloggen met inloglink per e-mail. Alleen de eigen installaties zien, per locatie en productielijn. Externe documenten openen. Spare parts aanvragen. Tickets aanmaken (storing, onderhoud, onderdelen, vraag) met prioriteit, en berichten uitwisselen. |
| Klantbeheerder | Daarnaast: collega's uitnodigen en hun toegang intrekken. |
| Fluidor-medewerker | Inloggen met het Microsoft-account. Ticketoverzicht van alle klanten met KPI's, filters en eigen tickets. Status, behandelaar, prioriteit en planning wijzigen. Interne notities die klanten niet zien. Documenten uploaden en per document kiezen of de klant het ziet. Onderdelenlijst per machine. |
| Coördinator / beheerder | Daarnaast: klanten, locaties, lijnen en installaties aanmaken, klantgebruikers uitnodigen en medewerkersrollen toekennen. |

Automatisch geregeld in de database:

- **Rechten per klant** (row-level security): een klant kan via geen enkele route gegevens van een andere klant lezen of wijzigen.
- **Ticketnummer** `SR-2026-00001` en **systeemberichten** bij wijziging van status, behandelaar en planning.
- **Eerste reactietijd** voor de KPI.
- Een reactie van de klant zet "Wacht op klant" automatisch terug naar "In behandeling".
- **Auditlog** van tickets en rechtenwijzigingen.

E-mailmeldingen gaan via SMTP (bijvoorbeeld een Microsoft 365-servicemailbox):

- nieuw ticket naar de servicedesk;
- reactie naar de klant of de behandelaar;
- statuswijziging naar de melder.

## Techniek

- **Next.js 14** (React, TypeScript), server-side gerenderd, formulieren via server actions.
- **Supabase**: PostgreSQL met row-level security, inloggen (Microsoft Entra ID en e-mail) en bestandsopslag. Supabase is open source. Gebruik Supabase Cloud in regio Frankfurt (`eu-central-1`) of draai het zelf op Azure.
- Hosting van de app: elke Node 20-omgeving. Er staat een `Dockerfile` klaar voor Azure Container Apps of App Service (West-Europa).

```
src/app/login, auth/          inloggen, terugkeer na login, uitloggen
src/app/(portal)/tickets       overzicht, nieuw ticket, ticketdetail + acties
src/app/(portal)/installaties  installed base, machinedetail, documenten, onderdelen
src/app/(portal)/beheer        klanten en medewerkers (coördinator/beheerder)
src/app/(portal)/collegas      klantbeheerder nodigt collega's uit
src/app/(portal)/documenten    beveiligd openen/downloaden van documenten
src/lib                        sessie en rollen, labels, e-mail, gebruikersbeheer
supabase/migrations            databaseschema, rechten en triggers
supabase/seed.sql              fictieve demogegevens (niet op productie)
supabase/tests                 test van de rechten per klant
scripts/                       import van de installed base uit CSV
```

## Lokaal starten

Vereist: Node 20+, Docker en de [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
supabase init            # maakt supabase/config.toml aan; bestaande migraties blijven staan
supabase start           # lokale database, auth en opslag
supabase db reset        # voert migraties + seed.sql uit
cp .env.example .env.local   # vul de URL en keys in uit de uitvoer van `supabase start`
npm run dev              # http://localhost:3000
```

**Eerste beheerder.** Log één keer in en zet daarna je eigen rol in de SQL-editor van Supabase:

```sql
update public.profiles set role = 'beheerder' where email = 'jouw.naam@fluidor.com';
```

Lokaal kun je inloglinks uit de testmailbox halen die `supabase start` toont (Inbucket/Mailpit).

**Rechten testen.** `supabase/tests/run.sh` test de rechten in een kale PostgreSQL. Het script controleert onder meer:

- een klant ziet alleen eigen machines, tickets en externe documenten;
- een klant kan geen ticket op een machine van een andere klant aanmaken;
- een klant leest geen interne notities;
- een klant kan zijn eigen rol niet ophogen.

## Inrichten in Supabase (productie)

1. **Project** aanmaken in regio *Central EU (Frankfurt)*. Voer de migratie uit met `supabase link` en daarna `supabase db push`. Draai `seed.sql` hier niet.
2. **Microsoft-login** (Authentication → Providers → Azure):
   - Maak in Entra ID een app-registratie, *single tenant*, alleen het Fluidor-tenant.
   - Redirect-URI: `https://<project>.supabase.co/auth/v1/callback`.
   - Vul in Supabase de client-ID en het secret in. Zet de *Azure Tenant URL* op `https://login.microsoftonline.com/<tenant-id>`.
   - Medewerkers met een `@fluidor.com`-adres krijgen bij de eerste login de rol *Medewerker*. Een beheerder geeft daarna de juiste rol.
   - Ander domein? Pas `app_settings.staff_email_domain` aan.
3. **E-mail-login** (Providers → Email): aan.
4. **E-mailtemplates** (Authentication → Email Templates):
   - In het template *Invite user* moet de link worden: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - Vertaal de teksten naar het Nederlands.
5. **URL-instellingen**: zet *Site URL* op het portaaladres en voeg `https://<portaal>/auth/callback` toe aan de redirect-URL's.
6. **SMTP** (Project settings → Auth → SMTP): stel jullie eigen mailserver in, zodat inloglinks van `service@fluidor.com` komen. De ingebouwde mailer van Supabase is alleen voor testen.

## Uitrollen van de app

Zet de variabelen uit `.env.example` in de hostingomgeving. `SUPABASE_SERVICE_ROLE_KEY` hoort alleen op de server: nooit in de browser of in git.

```bash
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... -t fluidor-portal .
docker run -p 3000:3000 --env-file .env fluidor-portal
```

## Installed base importeren

Exporteer klanten en projecten naar CSV met de kolommen uit `scripts/voorbeeld-installed-base.csv`. Daarna:

```bash
npm run import:installed-base -- export.csv --droog   # proefdraai: toont wat er zou gebeuren
npm run import:installed-base -- export.csv
```

Bestaande records worden bijgewerkt:

- klanten op debiteurnummer;
- installaties op projectnummer.

Documenten upload je per machine in het portaal. Een bulkimport uit PRO.FILE volgt in fase 3.

## Voor livegang nog te doen

- [ ] **Tweestapsverificatie voor klantbeheerders.** Supabase MFA (TOTP) inschakelen en het scherm bouwen waarmee een gebruiker het instelt. Dit zit nog niet in fase 1.
- [ ] **Beveiligingstest** (pentest) van portaal en database-rechten.
- [ ] **Verwerkersovereenkomst** met Supabase en de hostingpartij. Bewaartermijnen vastleggen.
- [ ] **Dagelijkse back-ups controleren** en één keer een herstel testen (Point-in-Time Recovery in Supabase Pro).
- [ ] **Monitoring en foutmeldingen** instellen, bijvoorbeeld Azure Application Insights.
- [ ] **Huisstijl controleren**: logo, kleuren en e-mailteksten.

## Volgende fases (zie ontwerp)

- **Fase 2**: planbord per monteur, monteursapp die offline werkt (PWA), checklists met handtekening, servicerapport als PDF, foto's bij tickets.
- **Fase 3**: AI-zoekfunctie in documentatie, AI-notulist, preventief onderhoud met herinneringen, koppelingen met Trimergo, PRO.FILE en IXON.
