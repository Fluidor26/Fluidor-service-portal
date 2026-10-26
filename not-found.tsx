import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card stack" style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: '1.3rem' }}>Niet gevonden</h1>
      <p className="muted" style={{ margin: 0 }}>Deze pagina bestaat niet of u heeft er geen toegang toe.</p>
      <Link className="btn" href="/">Naar het overzicht</Link>
    </div>
  );
}
