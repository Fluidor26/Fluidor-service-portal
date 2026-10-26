import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlashFromParams, Priority, StatusChip } from '@/components/ui';
import {
  contractYear, DOC_CATEGORY_LABEL, fmtBytes, fmtDate, MAINTENANCE_CYCLE, TYPE_LABEL,
} from '@/lib/labels';
import { getSession } from '@/lib/session';
import type { Component, Customer, DocumentRow, Machine, Ticket } from '@/lib/types';
import {
  addComponent, deleteComponent, deleteDocument, setDocumentVisibility, updateMachine, uploadDocument,
} from '../actions';

export const metadata = { title: 'Installatie · Fluidor Service Portal' };

export default async function MachinePage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string> }) {
  const { supabase, isStaff } = await getSession();
  const { data: mc } = await supabase.from('machines').select('*').eq('id', params.id).maybeSingle<Machine>();
  if (!mc) notFound();

  const [cu, comps, docs, tix, loc, line, note] = await Promise.all([
    supabase.from('customers').select('*').eq('id', mc.customer_id).single<Customer>(),
    supabase.from('components').select('*').eq('machine_id', mc.id).order('description'),
    supabase.from('documents').select('*').eq('machine_id', mc.id).order('category').order('title'),
    supabase.from('tickets').select('*').eq('machine_id', mc.id).order('created_at', { ascending: false }),
    mc.location_id ? supabase.from('locations').select('name, address').eq('id', mc.location_id).single() : Promise.resolve({ data: null }),
    mc.line_id ? supabase.from('production_lines').select('name').eq('id', mc.line_id).single() : Promise.resolve({ data: null }),
    isStaff
      ? supabase.from('internal_notes').select('body').eq('entity', 'machine').eq('entity_id', mc.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const notes = (note.data as { body: string } | null)?.body ?? '';
  const components = (comps.data ?? []) as Component[];
  const documents = (docs.data ?? []) as DocumentRow[];
  const tickets = (tix.data ?? []) as Ticket[];
  const year = contractYear(mc.contract_start);
  const location = loc.data as { name: string; address: string | null } | null;
  const lineName = (line.data as { name: string } | null)?.name;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link href="/installaties">{isStaff ? 'Installed base' : 'Mijn installaties'}</Link>
            {isStaff && <> / {cu.data?.name}</>} / <span className="mono">{mc.project_number}</span>
          </div>
          <h1>{mc.name}</h1>
          <p>{[location?.name, lineName].filter(Boolean).join(' · ')}</p>
        </div>
        <Link className="btn primary" href={`/tickets/nieuw?machine=${mc.id}`}>Melding maken</Link>
      </div>
      <FlashFromParams searchParams={searchParams} />

      <div className="detail">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card" id="documenten">
            <h2>Documentatie</h2>
            {documents.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Nog geen documenten{isStaff ? '' : ' beschikbaar'}.</p>
            ) : (
              <div className="tablebox" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>Document</th><th>Soort</th><th>Revisie</th>{isStaff && <th>Zichtbaar</th>}<th /></tr></thead>
                  <tbody>
                    {documents.map((d) => (
                      <tr key={d.id}>
                        <td><a className="rowlink" href={`/documenten/${d.id}`} target="_blank" rel="noopener">{d.title}</a>
                          <div className="sub">{d.file_name} {fmtBytes(d.size_bytes)}</div></td>
                        <td>{DOC_CATEGORY_LABEL[d.category] ?? d.category}</td>
                        <td>{d.revision ?? '–'}</td>
                        {isStaff && (
                          <td>
                            <form action={setDocumentVisibility}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="machine_id" value={mc.id} />
                              <input type="hidden" name="visibility" value={d.visibility === 'extern' ? 'intern' : 'extern'} />
                              <button className={`chip ${d.visibility === 'extern' ? 'ext' : 'int'}`} style={{ border: 0, cursor: 'pointer' }}
                                title={d.visibility === 'extern' ? 'Klik om alleen intern te maken' : 'Klik om zichtbaar te maken voor de klant'}>
                                {d.visibility === 'extern' ? 'Klant' : 'Intern'}
                              </button>
                            </form>
                          </td>
                        )}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <a className="btn small" href={`/documenten/${d.id}?download=1`}>Download</a>
                          {isStaff && (
                            <form action={deleteDocument} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="machine_id" value={mc.id} />
                              <button className="btn small danger" type="submit" title="Verwijderen">×</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {isStaff && (
              <details style={{ marginTop: 14 }}>
                <summary className="btn small" style={{ listStyle: 'none' }}>+ Document toevoegen</summary>
                <form action={uploadDocument} className="stack" style={{ marginTop: 12 }}>
                  <input type="hidden" name="machine_id" value={mc.id} />
                  <div className="field"><label htmlFor="file">Bestand (max. 25 MB)</label><input id="file" name="file" type="file" required /></div>
                  <div className="grid3">
                    <div className="field"><label htmlFor="title">Titel</label><input id="title" name="title" placeholder="Bijv. Handleiding" /></div>
                    <div className="field"><label htmlFor="category">Soort</label>
                      <select id="category" name="category" defaultValue="handleiding">
                        {Object.entries(DOC_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select></div>
                    <div className="field"><label htmlFor="revision">Revisie</label><input id="revision" name="revision" placeholder="Bijv. rev 2.0" /></div>
                  </div>
                  <label className="row" style={{ gap: 8 }}><input type="checkbox" name="visibility" value="extern" /> Zichtbaar voor de klant</label>
                  <div className="form-actions"><button className="btn primary" type="submit">Uploaden</button></div>
                </form>
              </details>
            )}
          </section>

          <section className="card" id="onderdelen">
            <h2>Onderdelen</h2>
            {components.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nog geen onderdelen vastgelegd.</p> : (
              <div className="tablebox" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>Artikelnr.</th><th>Omschrijving</th><th>Aantal</th><th /></tr></thead>
                  <tbody>
                    {components.map((c) => (
                      <tr key={c.id}>
                        <td className="mono">{c.article_number ?? '–'}</td>
                        <td>{c.description} {c.is_spare_part && <span className="chip ext" style={{ marginLeft: 6 }}>Spare part</span>}</td>
                        <td>{c.quantity}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {c.is_spare_part && (
                            <Link className="btn small" href={`/tickets/nieuw?machine=${mc.id}&type=onderdelen&omschrijving=${encodeURIComponent(`Graag aanbieding/levering van: ${c.article_number ?? ''} ${c.description}\nAantal: `)}`}>
                              Aanvragen
                            </Link>
                          )}
                          {isStaff && (
                            <form action={deleteComponent} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="machine_id" value={mc.id} />
                              <button className="btn small danger" type="submit" title="Verwijderen">×</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {isStaff && (
              <form action={addComponent} className="row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
                <input type="hidden" name="machine_id" value={mc.id} />
                <div className="field" style={{ width: 140 }}><label htmlFor="article_number">Artikelnr.</label><input id="article_number" name="article_number" /></div>
                <div className="field" style={{ flex: 1, minWidth: 200 }}><label htmlFor="cdesc">Omschrijving</label><input id="cdesc" name="description" required /></div>
                <div className="field" style={{ width: 80 }}><label htmlFor="qty">Aantal</label><input id="qty" name="quantity" type="number" min="0" step="any" defaultValue="1" /></div>
                <label className="row" style={{ gap: 6, paddingBottom: 8 }}><input type="checkbox" name="is_spare_part" /> Spare part</label>
                <button className="btn" type="submit">Toevoegen</button>
              </form>
            )}
          </section>

          <section className="card">
            <h2>Servicehistorie</h2>
            {tickets.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nog geen tickets voor deze installatie.</p> : (
              <ol className="timeline">
                {tickets.map((t) => (
                  <li key={t.id} className="staff">
                    <div>
                      <div className="who-line"><span className="mono">{t.number}</span> · {fmtDate(t.created_at)} · {TYPE_LABEL[t.type]}</div>
                      <div className="row" style={{ gap: 8 }}>
                        <Link href={`/tickets/${t.id}`} style={{ fontWeight: 600 }}>{t.title}</Link>
                        <StatusChip status={t.status} /> <Priority value={t.priority} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="stack" style={{ gap: 20 }}>
          <section className="card">
            <h2>Gegevens</h2>
            <dl className="specs">
              {isStaff && <><dt>Klant</dt><dd>{cu.data?.name}</dd></>}
              <dt>Projectnr.</dt><dd className="mono">{mc.project_number}</dd>
              <dt>Serienr.</dt><dd className="mono">{mc.serial_number ?? '–'}</dd>
              <dt>Type</dt><dd>{mc.machine_type ?? '–'}</dd>
              <dt>Opgeleverd</dt><dd>{fmtDate(mc.delivered_on)}</dd>
              {location?.address && <><dt>Adres</dt><dd>{location.address}</dd></>}
              <dt>Contract</dt><dd>{year ? `Service & Maintenance Plan, jaar ${year}` : 'Geen servicecontract'}</dd>
              {year && <><dt>Volgend bezoek</dt><dd>{MAINTENANCE_CYCLE[year - 1]}<br />{fmtDate(mc.next_service_on)}</dd></>}
            </dl>
          </section>
          {isStaff && (
            <details className="card">
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Gegevens wijzigen</summary>
              <form action={updateMachine} className="stack" style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={mc.id} />
                <div className="field"><label htmlFor="m-name">Naam</label><input id="m-name" name="name" defaultValue={mc.name} required /></div>
                <div className="field"><label htmlFor="m-serial">Serienummer</label><input id="m-serial" name="serial_number" defaultValue={mc.serial_number ?? ''} /></div>
                <div className="field"><label htmlFor="m-type">Type</label><input id="m-type" name="machine_type" defaultValue={mc.machine_type ?? ''} /></div>
                <div className="field"><label htmlFor="m-del">Opgeleverd</label><input id="m-del" name="delivered_on" type="date" defaultValue={mc.delivered_on ?? ''} /></div>
                <div className="field"><label htmlFor="m-cs">Start servicecontract</label><input id="m-cs" name="contract_start" type="date" defaultValue={mc.contract_start ?? ''} />
                  <span className="hint">Leeg = geen contract</span></div>
                <div className="field"><label htmlFor="m-next">Volgend servicebezoek</label><input id="m-next" name="next_service_on" type="date" defaultValue={mc.next_service_on ?? ''} /></div>
                <div className="field"><label htmlFor="m-notes">Interne notities</label><textarea id="m-notes" name="notes" defaultValue={notes} /></div>
                <button className="btn primary" type="submit">Opslaan</button>
              </form>
            </details>
          )}
          {isStaff && notes && <section className="card"><h2>Interne notities</h2><p className="desc">{notes}</p></section>}
        </aside>
      </div>
    </>
  );
}
