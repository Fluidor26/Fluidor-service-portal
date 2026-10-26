import { FlashFromParams } from '@/components/ui';
import { ROLE_LABEL, STAFF_ROLES } from '@/lib/labels';
import { requireAdmin } from '@/lib/session';
import type { Profile } from '@/lib/types';
import { setStaffRole, toggleUser } from '../actions';

export const metadata = { title: 'Medewerkers · Fluidor Service Portal' };

export default async function StaffPage({ searchParams }: { searchParams: Record<string, string> }) {
  const { supabase, user } = await requireAdmin();
  const { data } = await supabase.from('profiles').select('*').is('customer_id', null).order('full_name');
  const staff = (data ?? []) as Profile[];

  return (
    <>
      <div className="page-head">
        <div><h1>Medewerkers</h1>
          <p>Collega&apos;s krijgen een account zodra ze voor het eerst inloggen met hun Microsoft-account. Geef ze hier de juiste rol.</p></div>
      </div>
      <FlashFromParams searchParams={searchParams} />
      <div className="tablebox">
        <table>
          <thead><tr><th>Naam</th><th>E-mail</th><th>Rol</th><th>Toegang</th></tr></thead>
          <tbody>{staff.map((p) => (
            <tr key={p.id}>
              <td>{p.full_name}{p.id === user.id && <span className="muted"> (u)</span>}</td>
              <td>{p.email}</td>
              <td>
                <form action={setStaffRole} className="row inline" style={{ gap: 6 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <select name="role" defaultValue={p.role} aria-label={`Rol van ${p.full_name}`} style={{ width: 'auto' }}>
                    {[...STAFF_ROLES, 'geen' as const].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button className="btn small" type="submit">Opslaan</button>
                </form>
              </td>
              <td>
                {p.id !== user.id && (
                  <form action={toggleUser}>
                    <input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value="/beheer/medewerkers" />
                    <input type="hidden" name="active" value={p.active ? '0' : '1'} />
                    <button className={`btn small ${p.active ? 'danger' : ''}`} type="submit">{p.active ? 'Intrekken' : 'Herstellen'}</button>
                  </form>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: '.88rem' }}>
        Servicecoördinator en beheerder mogen klanten, installaties en gebruikers beheren. Monteur en medewerker kunnen tickets behandelen en documenten uploaden.
      </p>
    </>
  );
}
