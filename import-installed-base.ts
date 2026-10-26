/**
 * Importeert klanten, locaties, productielijnen en installaties uit een CSV-bestand
 * (bijv. een export uit Excel of Trimergo). Bestaande records worden bijgewerkt:
 *   klant      → op debiteurnummer, anders op naam
 *   locatie    → op klant + naam
 *   lijn       → op klant + naam
 *   installatie→ op projectnummer
 *
 * Gebruik:  npm run import:installed-base -- pad/naar/bestand.csv [--droog]
 * Kolommen: zie scripts/voorbeeld-installed-base.csv (scheidingsteken ; of ,).
 * Datums als DD-MM-JJJJ of JJJJ-MM-DD. "contract" = ja/nee.
 * Nodig in .env: NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile?.('.env'); } catch { /* geen .env: gebruik omgevingsvariabelen */ }

const file = process.argv[2];
const dryRun = process.argv.includes('--droog');
if (!file) {
  console.error('Gebruik: npm run import:installed-base -- bestand.csv [--droog]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
const delimiter = text.split('\n')[0]!.includes(';') ? ';' : ',';
const rows: Record<string, string>[] = parse(text, { columns: (h: string[]) => h.map((x) => x.trim().toLowerCase()), delimiter, skip_empty_lines: true, trim: true });

function date(v?: string): string | null {
  if (!v) return null;
  const nl = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (nl) return `${nl[3]}-${nl[2]!.padStart(2, '0')}-${nl[1]!.padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  throw new Error(`Onbekend datumformaat: "${v}"`);
}
const yes = (v?: string) => /^(ja|j|yes|y|1|true|x)$/i.test(v ?? '');

async function findOrCreate(table: string, match: Record<string, unknown>, values: Record<string, unknown>) {
  let q = db.from(table).select('id');
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v as string);
  const { data } = await q.maybeSingle();
  if (data) {
    if (!dryRun) await db.from(table).update(values).eq('id', data.id);
    return data.id as string;
  }
  if (dryRun) return `nieuw-${table}-${JSON.stringify(match)}`;
  const { data: created, error } = await db.from(table).insert({ ...match, ...values }).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return created.id as string;
}

let ok = 0;
const errors: string[] = [];
for (const [i, r] of rows.entries()) {
  const line = i + 2;
  try {
    if (!r.klant || !r.projectnummer || !r.machinenaam) throw new Error('klant, projectnummer en machinenaam zijn verplicht');
    const customerMatch = r.debiteurnummer ? { erp_number: r.debiteurnummer } : { name: r.klant };
    const customerId = await findOrCreate('customers', customerMatch, {
      name: r.klant, city: r.plaats || null, contract: yes(r.contract) ? 'service_maintenance_plan' : 'geen',
    });
    const locationId = r.locatie ? await findOrCreate('locations', { customer_id: customerId, name: r.locatie }, { address: r.adres || null }) : null;
    const lineId = r.productielijn ? await findOrCreate('production_lines', { customer_id: customerId, name: r.productielijn }, { location_id: locationId }) : null;
    await findOrCreate('machines', { project_number: r.projectnummer.toUpperCase() }, {
      customer_id: customerId, location_id: locationId, line_id: lineId,
      serial_number: r.serienummer || null, name: r.machinenaam, machine_type: r.machinetype || null,
      delivered_on: date(r.opgeleverd), contract_start: date(r.start_contract), next_service_on: date(r.volgend_bezoek),
    });
    ok++;
  } catch (e) {
    errors.push(`Regel ${line}: ${(e as Error).message}`);
  }
}

console.log(`${dryRun ? '[proefdraai] ' : ''}${ok} van ${rows.length} regels verwerkt.`);
if (errors.length) {
  console.log('Niet verwerkt:');
  errors.forEach((e) => console.log('  ' + e));
  process.exitCode = 1;
}
