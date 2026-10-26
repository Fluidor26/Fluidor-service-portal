import Link from 'next/link';
import { FlashFromParams } from '@/components/ui';
import { PRIORITY_LABEL, TYPE_LABEL, TYPES } from '@/lib/labels';
import { getSession } from '@/lib/session';
import { createTicket } from '../actions';

export const metadata = { title: 'Nieuw ticket · Fluidor Service Portal' };

type SP = { machine?: string; type?: string; omschrijving?: string; fout?: string };

export default async function NewTicketPage({ searchParams }: { searchParams: SP }) {
  const { supabase, isStaff, profile } = await getSession();
  const { data } = await supabase
    .from('machines')
    .select('id, project_number, name, customers(name)')
    .order('project_number');
  const machines = (data ?? []) as unknown as { id: string; project_number: string; name: string; customers: { name: string } }[];
  const type = TYPES.includes(searchParams.type as never) ? searchParams.type : 'storing';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumbs"><Link href="/tickets">Tickets</Link> / Nieuw</div>
          <h1>Nieuw serviceticket</h1>
          <p>Meld een storing, vraag onderhoud aan, bestel onderdelen of stel een vraag.</p>
        </div>
      </div>
      <FlashFromParams searchParams={searchParams} />
      {machines.length === 0 ? (
        <div className="card">Er zijn nog geen installaties aan uw account gekoppeld. Neem contact op met Fluidor.</div>
      ) : (
        <form action={createTicket} className="card stack" style={{ maxWidth: 780 }}>
          <div className="field">
            <label htmlFor="machine_id">Installatie</label>
            <select id="machine_id" name="machine_id" required defaultValue={searchParams.machine ?? ''}>
              <option value="">Kies een installatie</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.project_number} · {m.name}{isStaff ? ` (${m.customers?.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="type">Soort aanvraag</label>
              <select id="type" name="type" defaultValue={type}>
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="contact_name">Contactpersoon</label>
              <input id="contact_name" name="contact_name" defaultValue={isStaff ? '' : profile.full_name ?? ''} required />
            </div>
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="lbl">Prioriteit</legend>
            <div className="seg">
              {[1, 2, 3, 4].map((p) => (
                <label key={p} className={`p${p}`}>
                  <input type="radio" name="priority" value={p} defaultChecked={p === 2} />
                  <span>{PRIORITY_LABEL[p]}</span>
                </label>
              ))}
            </div>
            <span className="hint">Kies &quot;Machine staat stil&quot; alleen als de productie stilligt. Deze meldingen pakt Fluidor als eerste op.</span>
          </fieldset>
          <div className="field">
            <label htmlFor="title">Onderwerp</label>
            <input id="title" name="title" maxLength={160} required placeholder="Bijv. vacuümpomp slaat af na 15 minuten" />
          </div>
          <div className="field">
            <label htmlFor="description">Omschrijving</label>
            <textarea id="description" name="description" required defaultValue={searchParams.omschrijving ?? ''}
              placeholder="Wat ziet u gebeuren? Sinds wanneer? Welke foutcode staat op het HMI?" />
          </div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="contact_phone">Telefoonnummer voor terugbellen</label>
            <input id="contact_phone" name="contact_phone" type="tel" autoComplete="tel" />
          </div>
          <div className="form-actions">
            <Link className="btn" href="/tickets">Annuleren</Link>
            <button className="btn primary" type="submit">Ticket indienen</button>
          </div>
        </form>
      )}
    </>
  );
}
