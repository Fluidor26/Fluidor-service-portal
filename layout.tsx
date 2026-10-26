import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { NavLinks } from '@/components/NavLinks';
import { initials } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/labels';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile, isStaff, isAdmin, customer } = await getSession();

  const links = isStaff
    ? [
        { href: '/tickets', label: 'Tickets' },
        { href: '/installaties', label: 'Installed base' },
        ...(isAdmin
          ? [
              { href: '/beheer/klanten', label: 'Klanten' },
              { href: '/beheer/medewerkers', label: 'Medewerkers' },
            ]
          : []),
      ]
    : [
        { href: '/installaties', label: 'Mijn installaties' },
        { href: '/tickets', label: 'Mijn tickets' },
        { href: '/tickets/nieuw', label: 'Nieuw ticket' },
        ...(profile.role === 'klant_beheerder' ? [{ href: '/collegas', label: "Collega's" }] : []),
      ];

  return (
    <>
      <header className="topbar">
        <div className="topbar-in wrap">
          <Link href="/" className="logo">
            <LogoMark /> FLUIDOR <small>Service Portal</small>
          </Link>
          <NavLinks links={links} />
          <div className="who">
            <div className="meta">
              <b>{profile.full_name}</b>
              <span>{isStaff ? `Fluidor · ${ROLE_LABEL[profile.role]}` : customer?.name}</span>
            </div>
            <div className={`avatar ${isStaff ? 'f' : ''}`} aria-hidden="true">{initials(profile.full_name)}</div>
            <form action="/auth/uitloggen" method="post">
              <button className="btn small" type="submit">Uitloggen</button>
            </form>
          </div>
        </div>
      </header>
      <main className="wrap">
        <div className="page">{children}</div>
      </main>
    </>
  );
}
