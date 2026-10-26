import { LogoMark } from '@/components/Logo';

export default function NoAccess() {
  return (
    <main className="login wrap">
      <div className="card stack" style={{ maxWidth: 480 }}>
        <div className="row" style={{ color: 'var(--brand)' }}><LogoMark /> <b>Fluidor Service Portal</b></div>
        <h1 style={{ fontSize: '1.4rem' }}>Uw account heeft nog geen toegang</h1>
        <p className="muted" style={{ margin: 0 }}>
          U bent ingelogd, maar er is nog geen rol aan uw account gekoppeld. Neem contact op met de servicedesk van Fluidor,
          dan zetten wij uw toegang klaar.
        </p>
        <form action="/auth/uitloggen" method="post">
          <button className="btn" type="submit">Uitloggen</button>
        </form>
      </div>
    </main>
  );
}
