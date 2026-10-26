import Link from 'next/link';
import { FlashFromParams, Priority, StatusChip } from '@/components/ui';
import { fmtAge, fmtDate, fmtDuration, PRIORITY_LABEL, STATUS_LABEL, STATUSES, TYPE_LABEL } from '@/lib/labels';
import { getSession } from '@/lib/session';
import type { Customer, TicketOverview } from '@/lib/types';

export const metadata = { title: 'Tickets · Fluidor Service Portal' };

type SP = { q?: string; status?: string; klant?: string; prio?: string; mij?: string; ok?: string; fout?: string };

export default async function TicketsPage({ searchParams }: { searchParams: SP }) {
  const { supabase, isStaff, customer, user } = await getSession();
  const status = searchParams.status ?? 'open';
  const q = (searchParams.q ?? '').replace(/[,()%]/g, ' ').trim();

  let query = supabase.from('ticket_overview').select('*');
  if (status === 'open') query = query.neq('status', 'opgelost');
  else if (status) query = query.eq('status', status);
  if (searchParams.klant) query = query.eq('customer_id', searchParams.klant);
  if (searchParams.prio) query = query.eq('priority', Number(searchParams.prio));
  if (searchParams.mij) query = query.eq('assignee_id', user.id);
  if (q) {
    query = query.or(
      ['number', 'title', 'project_number', 'customer_name', 'machine_name'].map((c) => `${c}.ilike.%${q}%`).join(','),
    );
  }
  const { data, error } = await query
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);
  const tickets = (data ?? []) as TicketOverview[];

  // KPI's voor Fluidor
  let kpi: { open: number; stil: number; nieuw: number; wacht: number; reactie: number | null } | null = null;
  let customers: Pick<Customer, 'id' | 'name'>[] = [];
  if (isStaff) {
    const count = async (f: (q: any) => any) => {
      const { count } = await f(supabase.from('tickets').select('id', { count: 'exact', head: true }));
      return count ?? 0;
    };
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [open, stil, nieuw, wacht, resp, cust] = await Promise.all([
      count((x) => x.neq('status', 'opgelost')),
      count((x) => x.neq('status', 'opgelost').eq('priority', 4)),
      count((x) => x.eq('status', 'nieuw')),
      count((x) => x.eq('status', 'wacht_op_klant')),
      supabase.from('tickets').select('created_at, first_response_at').gte('created_at', since).not('first_response_at', 'is', null),
      supabase.from('customers').select('id, name').order('name'),
    ]);
    const rows = (resp.data ?? []) as { created_at: string; first_response_at: string }[];
    const reactie = rows.length
      ? rows.reduce((s, r) => s + (new Date(r.first_response_at).getTime() - new Date(r.created_at).getTime()), 0) / rows.length / 36e5
      : null;
    kpi = { open, stil, nieuw, wacht, reactie };
    customers = (cust.data ?? []) as Pick<Customer, 'id' | 'name'>[];
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isStaff ? 'Serviceticketoverzicht' : 'Mijn tickets'}</h1>
          <p>{isStaff ? 'Alle serviceaanvragen van alle klanten.' : `Serviceaanvragen van ${customer?.name}.`}</p>
        </div>
        <Link className="btn primary" href="/tickets/nieuw">+ Nieuw ticket</Link>
      </div>
      <FlashFromParams searchParams={searchParams} />

      {kpi && (
        <div className="kpis">
          <Link className="kpi" href="/tickets"><span className="label">Open tickets</span><span className="n">{kpi.open}</span></Link>
          <Link className="kpi crit" href="/tickets?prio=4"><span className="label">Machine staat stil</span><span className="n">{kpi.stil}</span></Link>
          <Link className="kpi" href="/tickets?status=nieuw"><span className="label">Nieuw, nog oppakken</span><span className="n">{kpi.nieuw}</span></Link>
          <Link className="kpi warn" href="/tickets?status=wacht_op_klant"><span className="label">Wacht op klant</span><span className="n">{kpi.wacht}</span></Link>
          <div className="kpi"><span className="label">Gem. eerste reactie, 30 d</span><span className="n">{fmtDuration(kpi.reactie)}</span></div>
        </div>
      )}

      <form className="filters" method="get">
        <input type="search" name="q" defaultValue={searchParams.q ?? ''} placeholder="Zoek op ticket, onderwerp, project of klant" aria-label="Zoeken" />
        <select name="status" defaultValue={status} aria-label="Status">
          <option value="open">Alle open</option>
          <option value="">Alle statussen</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {isStaff && (
          <select name="klant" defaultValue={searchParams.klant ?? ''} aria-label="Klant">
            <option value="">Alle klanten</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select name="prio" defaultValue={searchParams.prio ?? ''} aria-label="Prioriteit">
          <option value="">Alle prioriteiten</option>
          {[4, 3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        {isStaff && (
          <label className="row" style={{ gap: 6, fontSize: '.9rem' }}>
            <input type="checkbox" name="mij" value="1" defaultChecked={!!searchParams.mij} /> Aan mij toegewezen
          </label>
        )}
        <button className="btn" type="submit">Filter</button>
      </form>

      <div className="tablebox">
        {error ? (
          <div className="empty">Tickets konden niet worden geladen. Ververs de pagina.</div>
        ) : tickets.length === 0 ? (
          <div className="empty">
            Geen tickets gevonden. {!isStaff && <>Meld een storing of vraag via <Link href="/tickets/nieuw">Nieuw ticket</Link>.</>}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ticket</th><th>Onderwerp</th>{isStaff && <th>Klant</th>}<th>Machine</th>
                <th>Prioriteit</th><th>Status</th>{isStaff && <th className="hide-sm">Behandelaar</th>}<th className="hide-sm">Leeftijd</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="clickable">
                  <td className={`prio-stripe p${t.priority}`}>
                    <Link className="rowlink mono" href={`/tickets/${t.id}`}>{t.number}</Link>
                    <div className="sub">{fmtDate(t.created_at)}</div>
                  </td>
                  <td><Link className="rowlink" href={`/tickets/${t.id}`}>{t.title}</Link><div className="sub">{TYPE_LABEL[t.type]}</div></td>
                  {isStaff && <td>{t.customer_name}</td>}
                  <td><span className="mono">{t.project_number}</span><div className="sub">{t.machine_name}</div></td>
                  <td><Priority value={t.priority} /></td>
                  <td><StatusChip status={t.status} /></td>
                  {isStaff && <td className="hide-sm">{t.assignee_name ?? <span className="muted">Niet toegewezen</span>}</td>}
                  <td className="hide-sm mono">{t.status === 'opgelost' ? '–' : fmtAge(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
