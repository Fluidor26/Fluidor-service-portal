import Link from 'next/link';
import { FlashFromParams } from '@/components/ui';
import { requireAdmin } from '@/lib/session';
import type { Customer } from '@/lib/types';
import { createCustomer } from '../actions';

export const metadata = { title: 'Klanten · Fluidor Service Portal' };

export default async function CustomersPage({ searchParams }: { searchParams: Record<string, string> }) {
  const { supabase } = await requireAdmin();
  const [c, m, u, t] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('machines').select('customer_id'),
    supabase.from('profiles').select('customer_id').not('customer_id', 'is', null).eq('active', true),
    supabase.from('tickets').select('customer_id').neq('status', 'opgelost'),
  ]);
  const tally = (rows: { customer_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) map.set(r.customer_id, (map.get(r.customer_id) ?? 0) + 1);
    return map;
  };
  const machines = tally(m.data), users = tally(u.data), open = tally(t.data);
  const customers = (c.data ?? []) as Customer[];

  return (
    <>
      <div className="page-head"><div><h1>Klanten</h1><p>Klanten, hun installaties en wie toegang heeft tot het portaal.</p></div></div>
      <FlashFromParams searchParams={searchParams} />
      <div className="tablebox">
        <table>
          <thead><tr><th>Klant</th><th>Debiteurnr.</th><th>Contract</th><th>Installaties</th><th>Gebruikers</th><th>Open tickets</th></tr></thead>
          <tbody>
            {customers.map((cu) => (
              <tr key={cu.id} className="clickable">
                <td><Link className="rowlink" href={`/beheer/klanten/${cu.id}`}>{cu.name}</Link><div className="sub">{cu.city}</div></td>
                <td className="mono">{cu.erp_number ?? '–'}</td>
                <td>{cu.contract === 'service_maintenance_plan' ? 'Service & Maintenance Plan' : <span className="muted">Geen</span>}</td>
                <td>{machines.get(cu.id) ?? 0}</td>
                <td>{users.get(cu.id) ?? 0}</td>
                <td>{open.get(cu.id) ?? 0}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={6} className="empty">Nog geen klanten. Voeg hieronder de eerste toe of gebruik de import.</td></tr>}
          </tbody>
        </table>
      </div>
      <form action={createCustomer} className="card stack" style={{ maxWidth: 780 }}>
        <h2 style={{ margin: 0 }}>Klant toevoegen</h2>
        <div className="grid2">
          <div className="field"><label htmlFor="name">Naam</label><input id="name" name="name" required /></div>
          <div className="field"><label htmlFor="city">Plaats</label><input id="city" name="city" /></div>
          <div className="field"><label htmlFor="erp">Debiteurnummer (Trimergo)</label><input id="erp" name="erp_number" /></div>
          <div className="field"><label htmlFor="contract">Contract</label>
            <select id="contract" name="contract" defaultValue="geen">
              <option value="geen">Geen servicecontract</option>
              <option value="service_maintenance_plan">Service &amp; Maintenance Plan</option>
            </select></div>
        </div>
        <div className="form-actions"><button className="btn primary" type="submit">Klant aanmaken</button></div>
      </form>
    </>
  );
}
