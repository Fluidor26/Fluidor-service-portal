import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlashFromParams } from '@/components/ui';
import { fmtDate, ROLE_LABEL } from '@/lib/labels';
import { requireAdmin } from '@/lib/session';
import type { Customer, Location, Machine, ProductionLine, Profile } from '@/lib/types';
import { addLine, addLocation, addMachine, inviteCustomerUser, toggleUser, updateCustomer } from '../../actions';

export const metadata = { title: 'Klant · Fluidor Service Portal' };

export default async function CustomerAdminPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string> }) {
  const { supabase } = await requireAdmin();
  const { data: cu } = await supabase.from('customers').select('*').eq('id', params.id).maybeSingle<Customer>();
  if (!cu) notFound();
  const [l, pl, m, u, n] = await Promise.all([
    supabase.from('locations').select('*').eq('customer_id', cu.id).order('name'),
    supabase.from('production_lines').select('*').eq('customer_id', cu.id).order('sort_order'),
    supabase.from('machines').select('*').eq('customer_id', cu.id).order('project_number'),
    supabase.from('profiles').select('*').eq('customer_id', cu.id).order('full_name'),
    supabase.from('internal_notes').select('body').eq('entity', 'customer').eq('entity_id', cu.id).maybeSingle(),
  ]);
  const locations = (l.data ?? []) as Location[];
  const lines = (pl.data ?? []) as ProductionLine[];
  const machines = (m.data ?? []) as Machine[];
  const users = (u.data ?? []) as Profile[];
  const self = `/beheer/klanten/${cu.id}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumbs"><Link href="/beheer/klanten">Klanten</Link> / {cu.name}</div>
          <h1>{cu.name}</h1>
          <p>{cu.city}</p>
        </div>
      </div>
      <FlashFromParams searchParams={searchParams} />

      <div className="detail">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card">
            <h2>Installaties ({machines.length})</h2>
            {machines.length > 0 && (
              <div className="tablebox" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>Project</th><th>Naam</th><th>Serienr.</th><th>Opgeleverd</th></tr></thead>
                  <tbody>{machines.map((mc) => (
                    <tr key={mc.id}><td><Link className="rowlink mono" href={`/installaties/${mc.id}`}>{mc.project_number}</Link></td>
                      <td>{mc.name}</td><td className="mono">{mc.serial_number ?? '–'}</td><td>{fmtDate(mc.delivered_on)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <details style={{ marginTop: 12 }}>
              <summary className="btn small" style={{ listStyle: 'none' }}>+ Installatie toevoegen</summary>
              <form action={addMachine} className="stack" style={{ marginTop: 12 }}>
                <input type="hidden" name="customer_id" value={cu.id} />
                <div className="grid3">
                  <div className="field"><label htmlFor="pn">Projectnummer</label><input id="pn" name="project_number" required placeholder="680-FE-2025" /></div>
                  <div className="field"><label htmlFor="sn">Serienummer</label><input id="sn" name="serial_number" /></div>
                  <div className="field"><label htmlFor="mt">Type</label><input id="mt" name="machine_type" placeholder="Vacuümtransport" /></div>
                </div>
                <div className="field"><label htmlFor="mn">Naam</label><input id="mn" name="name" required /></div>
                <div className="grid2">
                  <div className="field"><label htmlFor="ml">Locatie</label>
                    <select id="ml" name="location_id" defaultValue=""><option value="">–</option>{locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                  <div className="field"><label htmlFor="mli">Productielijn</label>
                    <select id="mli" name="line_id" defaultValue=""><option value="">–</option>{lines.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                </div>
                <div className="grid3">
                  <div className="field"><label htmlFor="md">Opgeleverd</label><input id="md" name="delivered_on" type="date" /></div>
                  <div className="field"><label htmlFor="mc">Start servicecontract</label><input id="mc" name="contract_start" type="date" /></div>
                  <div className="field"><label htmlFor="mx">Volgend servicebezoek</label><input id="mx" name="next_service_on" type="date" /></div>
                </div>
                <div className="form-actions"><button className="btn primary" type="submit">Installatie toevoegen</button></div>
              </form>
            </details>
          </section>

          <section className="card">
            <h2>Portaalgebruikers ({users.filter((x) => x.active).length})</h2>
            {users.length > 0 && (
              <div className="tablebox" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>Naam</th><th>E-mail</th><th>Rol</th><th /></tr></thead>
                  <tbody>{users.map((x) => (
                    <tr key={x.id}>
                      <td>{x.full_name}{!x.active && <span className="chip int" style={{ marginLeft: 6 }}>Geen toegang</span>}</td>
                      <td>{x.email}</td><td>{ROLE_LABEL[x.role]}</td>
                      <td><form action={toggleUser}>
                        <input type="hidden" name="id" value={x.id} /><input type="hidden" name="back" value={self} />
                        <input type="hidden" name="active" value={x.active ? '0' : '1'} />
                        <button className={`btn small ${x.active ? 'danger' : ''}`} type="submit">{x.active ? 'Toegang intrekken' : 'Toegang herstellen'}</button>
                      </form></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <form action={inviteCustomerUser} className="row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <input type="hidden" name="customer_id" value={cu.id} />
              <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="un">Naam</label><input id="un" name="full_name" required /></div>
              <div className="field" style={{ flex: '1 1 220px' }}><label htmlFor="ue">E-mail</label><input id="ue" name="email" type="email" required /></div>
              <div className="field" style={{ width: 170 }}><label htmlFor="ur">Rol</label>
                <select id="ur" name="role" defaultValue="klant_gebruiker">
                  <option value="klant_gebruiker">Klantgebruiker</option>
                  <option value="klant_beheerder">Klantbeheerder</option>
                </select></div>
              <button className="btn primary" type="submit">Uitnodigen</button>
            </form>
            <p className="muted" style={{ fontSize: '.85rem', marginBottom: 0 }}>Een klantbeheerder kan zelf collega&apos;s uitnodigen. Elke klantgebruiker ziet alle installaties van deze klant.</p>
          </section>
        </div>

        <aside className="stack" style={{ gap: 20 }}>
          <form action={updateCustomer} className="card stack">
            <h2 style={{ margin: 0 }}>Gegevens</h2>
            <input type="hidden" name="id" value={cu.id} />
            <div className="field"><label htmlFor="cn">Naam</label><input id="cn" name="name" defaultValue={cu.name} required /></div>
            <div className="field"><label htmlFor="cc">Plaats</label><input id="cc" name="city" defaultValue={cu.city ?? ''} /></div>
            <div className="field"><label htmlFor="ce">Debiteurnummer</label><input id="ce" name="erp_number" defaultValue={cu.erp_number ?? ''} /></div>
            <div className="field"><label htmlFor="ct">Contract</label>
              <select id="ct" name="contract" defaultValue={cu.contract}>
                <option value="geen">Geen servicecontract</option>
                <option value="service_maintenance_plan">Service &amp; Maintenance Plan</option>
              </select></div>
            <div className="field"><label htmlFor="cno">Interne notities</label><textarea id="cno" name="notes" defaultValue={(n.data as { body: string } | null)?.body ?? ''} />
              <span className="hint">Alleen zichtbaar voor Fluidor.</span></div>
            <button className="btn primary" type="submit">Opslaan</button>
          </form>
          <section className="card stack">
            <h2 style={{ margin: 0 }}>Locaties en lijnen</h2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {locations.map((x) => (
                <li key={x.id}><b>{x.name}</b>{x.address && <span className="muted"> · {x.address}</span>}
                  <ul>{lines.filter((y) => y.location_id === x.id).map((y) => <li key={y.id}>{y.name}</li>)}</ul></li>
              ))}
              {lines.filter((y) => !y.location_id).map((y) => <li key={y.id}>{y.name}</li>)}
            </ul>
            <form action={addLocation} className="stack">
              <input type="hidden" name="customer_id" value={cu.id} />
              <div className="field"><label htmlFor="ln">Nieuwe locatie</label><input id="ln" name="name" placeholder="Naam" required /></div>
              <input name="address" placeholder="Adres" aria-label="Adres" className="field" style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg)' }} />
              <button className="btn small" type="submit">Locatie toevoegen</button>
            </form>
            <form action={addLine} className="stack">
              <input type="hidden" name="customer_id" value={cu.id} />
              <div className="field"><label htmlFor="pln">Nieuwe productielijn</label><input id="pln" name="name" placeholder="Naam" required /></div>
              <select name="location_id" aria-label="Locatie" defaultValue="" style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg)' }}>
                <option value="">Locatie (optioneel)</option>{locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <button className="btn small" type="submit">Lijn toevoegen</button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
