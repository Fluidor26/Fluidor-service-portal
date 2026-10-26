import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlashFromParams, Priority, StatusChip } from '@/components/ui';
import { fmtDate, fmtDateTime, PRIORITY_LABEL, STATUS_LABEL, STATUSES, TYPE_LABEL } from '@/lib/labels';
import { getSession } from '@/lib/session';
import type { Person, TicketMessage, TicketOverview } from '@/lib/types';
import { addMessage, updateTicket } from '../actions';

export const metadata = { title: 'Ticket · Fluidor Service Portal' };

export default async function TicketPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string> }) {
  const { supabase, isStaff } = await getSession();
  const { data: t } = await supabase.from('ticket_overview').select('*').eq('id', params.id).maybeSingle<TicketOverview>();
  if (!t) notFound();

  const [{ data: msgs }, { data: staff }] = await Promise.all([
    supabase.from('ticket_messages').select('*').eq('ticket_id', t.id).order('created_at'),
    isStaff
      ? supabase.from('people').select('id, full_name, is_staff').eq('is_staff', true).order('full_name')
      : Promise.resolve({ data: [] as Person[] }),
  ]);
  const messages = (msgs ?? []) as TicketMessage[];
  const authorIds = Array.from(new Set(messages.map((m) => m.author_id).filter(Boolean))) as string[];
  const { data: ppl } = authorIds.length
    ? await supabase.from('people').select('id, full_name, is_staff').in('id', authorIds)
    : { data: [] as Person[] };
  const people = new Map(((ppl ?? []) as Person[]).map((p) => [p.id, p]));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumbs"><Link href="/tickets">Tickets</Link> / <span className="mono">{t.number}</span></div>
          <h1>{t.title}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <StatusChip status={t.status} />
            <Priority value={t.priority} />
            <span className="muted">· {TYPE_LABEL[t.type]}</span>
          </div>
        </div>
      </div>
      <FlashFromParams searchParams={searchParams} />

      <div className="detail">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card">
            <h2>Omschrijving</h2>
            <p className="desc">{t.description}</p>
          </section>

          <section className="card" id="verloop">
            <h2>Verloop</h2>
            <ol className="timeline">
              {messages.map((m) => {
                const p = m.author_id ? people.get(m.author_id) : undefined;
                const cls = m.kind === 'systeem' ? 'systeem' : m.kind === 'intern' ? 'intern staff' : p?.is_staff ? 'staff' : '';
                return (
                  <li key={m.id} className={cls}>
                    <div>
                      <div className="who-line">
                        {p?.full_name ?? (m.kind === 'systeem' ? 'Systeem' : 'Onbekend')}
                        {p?.is_staff && m.kind !== 'systeem' ? ' · Fluidor' : ''} · {fmtDateTime(m.created_at)}
                        {m.kind === 'intern' && <b> · interne notitie</b>}
                      </div>
                      <div className="msg">{m.body}</div>
                    </div>
                  </li>
                );
              })}
              {messages.length === 0 && <li className="systeem"><div className="msg">Nog geen berichten.</div></li>}
            </ol>

            <form action={addMessage} className="stack" style={{ marginTop: 8 }}>
              <input type="hidden" name="ticket_id" value={t.id} />
              <div className="field">
                <label htmlFor="body">{isStaff ? 'Bericht' : 'Reactie aan Fluidor'}</label>
                <textarea id="body" name="body" required placeholder="Typ uw bericht…" />
              </div>
              <div className="form-actions">
                {isStaff && (
                  <select name="kind" aria-label="Soort bericht" className="btn" defaultValue="bericht">
                    <option value="bericht">Zichtbaar voor klant</option>
                    <option value="intern">Interne notitie (alleen Fluidor)</option>
                  </select>
                )}
                <button className="btn primary" type="submit">Plaatsen</button>
              </div>
            </form>
          </section>
        </div>

        <aside className="stack" style={{ gap: 20 }}>
          {isStaff && (
            <form action={updateTicket} className="card stack">
              <h2 style={{ marginBottom: 0 }}>Behandeling</h2>
              <input type="hidden" name="ticket_id" value={t.id} />
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={t.status}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="assignee_id">Behandelaar</label>
                <select id="assignee_id" name="assignee_id" defaultValue={t.assignee_id ?? ''}>
                  <option value="">Niet toegewezen</option>
                  {((staff ?? []) as Person[]).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="priority">Prioriteit</label>
                <select id="priority" name="priority" defaultValue={String(t.priority)}>
                  {[4, 3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="planned_on">Ingepland op</label>
                <input id="planned_on" name="planned_on" type="date" defaultValue={t.planned_on ?? ''} />
              </div>
              <button className="btn primary" type="submit">Opslaan</button>
            </form>
          )}
          <section className="card">
            <h2>Gegevens</h2>
            <dl className="specs">
              {isStaff && <><dt>Klant</dt><dd>{t.customer_name}</dd></>}
              <dt>Installatie</dt>
              <dd><Link href={`/installaties/${t.machine_id}`} className="mono">{t.project_number}</Link><br />{t.machine_name}</dd>
              <dt>Serienummer</dt><dd className="mono">{t.serial_number ?? '–'}</dd>
              <dt>Contact</dt><dd>{t.contact_name ?? '–'}{t.contact_phone && <><br />{t.contact_phone}</>}</dd>
              <dt>Aangemaakt</dt><dd>{fmtDateTime(t.created_at)}</dd>
              <dt>Behandelaar</dt><dd>{t.assignee_name ?? <span className="muted">Nog niet toegewezen</span>}</dd>
              {t.planned_on && <><dt>Ingepland</dt><dd>{fmtDate(t.planned_on)}</dd></>}
              {t.resolved_at && <><dt>Opgelost</dt><dd>{fmtDateTime(t.resolved_at)}</dd></>}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
