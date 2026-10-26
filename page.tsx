import { redirect } from 'next/navigation';
import { FlashFromParams } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/labels';
import { getSession } from '@/lib/session';
import type { Profile } from '@/lib/types';
import { inviteCustomerUser, toggleUser } from '../beheer/actions';

export const metadata = { title: "Collega's · Fluidor Service Portal" };

export default async function ColleaguesPage({ searchParams }: { searchParams: Record<string, string> }) {
  const { supabase, profile, customer } = await getSession();
  if (profile.role !== 'klant_beheerder') redirect('/');
  const { data } = await supabase.from('profiles').select('*').eq('customer_id', profile.customer_id!).order('full_name');
  const users = (data ?? []) as Profile[];

  return (
    <>
      <div className="page-head"><div><h1>Collega&apos;s</h1><p>Wie van {customer?.name} toegang heeft tot het portaal.</p></div></div>
      <FlashFromParams searchParams={searchParams} />
      <div className="tablebox">
        <table>
          <thead><tr><th>Naam</th><th>E-mail</th><th>Rol</th><th /></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td>{u.full_name}{!u.active && <span className="chip int" style={{ marginLeft: 6 }}>Geen toegang</span>}</td>
              <td>{u.email}</td><td>{ROLE_LABEL[u.role]}</td>
              <td>{u.role === 'klant_gebruiker' && (
                <form action={toggleUser}>
                  <input type="hidden" name="id" value={u.id} /><input type="hidden" name="back" value="/collegas" />
                  <input type="hidden" name="active" value={u.active ? '0' : '1'} />
                  <button className={`btn small ${u.active ? 'danger' : ''}`} type="submit">{u.active ? 'Toegang intrekken' : 'Toegang herstellen'}</button>
                </form>
              )}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <form action={inviteCustomerUser} className="card row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="n">Naam</label><input id="n" name="full_name" required /></div>
        <div className="field" style={{ flex: '1 1 240px' }}><label htmlFor="e">E-mail</label><input id="e" name="email" type="email" required /></div>
        <button className="btn primary" type="submit">Collega uitnodigen</button>
      </form>
    </>
  );
}
