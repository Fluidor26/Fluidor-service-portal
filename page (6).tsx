import Link from 'next/link';
import { contractYear, fmtDate, MAINTENANCE_CYCLE } from '@/lib/labels';
import { getSession } from '@/lib/session';
import type { Customer, Location, Machine, ProductionLine } from '@/lib/types';

export const metadata = { title: 'Installaties · Fluidor Service Portal' };

export default async function InstallationsPage({ searchParams }: { searchParams: { q?: string } }) {
  const { supabase, isStaff, customer } = await getSession();
  const q = (searchParams.q ?? '').replace(/[,()%]/g, ' ').trim();

  let mq = supabase.from('machines').select('*').order('project_number');
  if (q) mq = mq.or(['project_number', 'serial_number', 'name'].map((c) => `${c}.ilike.%${q}%`).join(','));
  const [m, c, l, pl, open] = await Promise.all([
    mq,
    supabase.from('customers').select('*').order('name'),
    supabase.from('locations').select('*'),
    supabase.from('production_lines').select('*').order('sort_order'),
    supabase.from('tickets').select('machine_id').neq('status', 'opgelost'),
  ]);
  const machines = (m.data ?? []) as Machine[];
  const customers = (c.data ?? []) as Customer[];
  const locations = new Map(((l.data ?? []) as Location[]).map((x) => [x.id, x]));
  const lines = new Map(((pl.data ?? []) as ProductionLine[]).map((x) => [x.id, x]));
  const openCount = new Map<string, number>();
  for (const r of (open.data ?? []) as { machine_id: string }[]) openCount.set(r.machine_id, (openCount.get(r.machine_id) ?? 0) + 1);

  const card = (mc: Machine) => {
    const year = contractYear(mc.contract_start);
    const n = openCount.get(mc.id) ?? 0;
    const where = [mc.location_id && locations.get(mc.location_id)?.name, mc.line_id && lines.get(mc.line_id)?.name].filter(Boolean).join(' · ');
    return (
      <article className="machine" key={mc.id}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="projnr">{mc.project_number}</div>
            <h3><Link href={`/installaties/${mc.id}`}>{mc.name}</Link></h3>
            {where && <div className="muted" style={{ fontSize: '.85rem' }}>{where}</div>}
          </div>
          {n > 0 ? <span className="chip st-in_behandeling">{n} open</span> : <span className="chip ok">Geen meldingen</span>}
        </div>
        <dl className="specs">
          <dt>Serienummer</dt><dd className="mono">{mc.serial_number ?? '–'}</dd>
          <dt>Opgeleverd</dt><dd>{fmtDate(mc.delivered_on)}</dd>
          <dt>Contract</dt><dd>{year ? 'Service & Maintenance Plan' : <span className="muted">Geen servicecontract</span>}</dd>
          {year && <><dt>Volgend bezoek</dt><dd>{MAINTENANCE_CYCLE[year - 1]}, {fmtDate(mc.next_service_on)}</dd></>}
        </dl>
        {year && (
          <div>
            <div className="label" style={{ marginBottom: 5 }}>Onderhoudscyclus, jaar {year} van 6</div>
            <div className="cycle" aria-hidden="true">
              {MAINTENANCE_CYCLE.map((label, i) => <span key={i} title={`Jaar ${i + 1}: ${label}`} className={i < year - 1 ? 'done' : i === year - 1 ? 'now' : ''} />)}
            </div>
          </div>
        )}
        <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <Link className="btn small" href={`/installaties/${mc.id}`}>Details en documenten</Link>
          <Link className="btn small primary" href={`/tickets/nieuw?machine=${mc.id}`}>Melding maken</Link>
        </div>
      </article>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isStaff ? 'Installed base' : 'Mijn installaties'}</h1>
          <p>{isStaff ? `${machines.length} installaties bij ${customers.length} klanten.` : `${customer?.name}${customer?.city ? ', ' + customer.city : ''}`}</p>
        </div>
        <form className="filters" method="get">
          <input type="search" name="q" defaultValue={searchParams.q ?? ''} placeholder="Zoek op project, serienummer of naam" aria-label="Zoeken" />
        </form>
      </div>
      {machines.length === 0 && <div className="card empty">Geen installaties gevonden.</div>}
      {isStaff
        ? customers
            .filter((cu) => machines.some((mc) => mc.customer_id === cu.id))
            .map((cu) => (
              <section className="group" key={cu.id}>
                <h2>{cu.name} <span>{cu.city}</span></h2>
                <div className="machines">{machines.filter((mc) => mc.customer_id === cu.id).map(card)}</div>
              </section>
            ))
        : <div className="machines">{machines.map(card)}</div>}
    </>
  );
}
