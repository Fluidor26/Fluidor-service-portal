import { LogoMark } from '@/components/Logo';
import { Notice } from '@/components/ui';
import { sendLoginLink, signInWithMicrosoft } from './actions';

export const metadata = { title: 'Inloggen · Fluidor Service Portal' };

export default function LoginPage({ searchParams }: { searchParams: { fout?: string; verstuurd?: string } }) {
  return (
    <main className="login wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="row" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem' }}>
            <LogoMark size={26} /> FLUIDOR
          </div>
          <h1>Service Portal</h1>
          <p>Uw installaties, documentatie en serviceaanvragen op één plek.</p>
        </div>
        <div className="login-form">
          <h2 style={{ fontSize: '1.25rem' }}>Inloggen</h2>
          {searchParams.fout && <Notice kind="err">{searchParams.fout}</Notice>}
          {searchParams.verstuurd && (
            <Notice kind="ok">Als dit adres toegang heeft, staat er nu een inloglink in uw mailbox. De link is 1 uur geldig.</Notice>
          )}

          <form action={sendLoginLink} className="stack">
            <div className="field">
              <label htmlFor="email">E-mailadres</label>
              <input id="email" name="email" type="email" autoComplete="email" required placeholder="naam@bedrijf.nl" />
              <span className="hint">U ontvangt een inloglink per e-mail. Nog geen toegang? Neem contact op met Fluidor.</span>
            </div>
            <button className="btn primary" type="submit">Stuur inloglink</button>
          </form>

          <div className="divider">Medewerker van Fluidor</div>
          <form action={signInWithMicrosoft}>
            <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
              Inloggen met Microsoft
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
