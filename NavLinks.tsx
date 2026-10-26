'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  // Het langste passende pad is actief (zodat /tickets/nieuw niet ook /tickets markeert).
  const active = links
    .filter((l) => path === l.href || path.startsWith(l.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="tabs" aria-label="Hoofdmenu">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.href === active ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
