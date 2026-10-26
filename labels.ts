import type { Role, TicketStatus, TicketType } from './types';

export const STAFF_ROLES: Role[] = ['beheerder', 'coordinator', 'monteur', 'medewerker'];
export const ADMIN_ROLES: Role[] = ['beheerder', 'coordinator'];
export const CUSTOMER_ROLES: Role[] = ['klant_beheerder', 'klant_gebruiker'];

export const ROLE_LABEL: Record<Role, string> = {
  beheerder: 'Beheerder',
  coordinator: 'Servicecoördinator',
  monteur: 'Servicemonteur',
  medewerker: 'Medewerker',
  klant_beheerder: 'Klantbeheerder',
  klant_gebruiker: 'Klantgebruiker',
  geen: 'Geen toegang',
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  nieuw: 'Nieuw',
  in_behandeling: 'In behandeling',
  ingepland: 'Ingepland',
  wacht_op_klant: 'Wacht op klant',
  opgelost: 'Opgelost',
};
export const STATUSES = Object.keys(STATUS_LABEL) as TicketStatus[];

export const TYPE_LABEL: Record<TicketType, string> = {
  storing: 'Storing',
  onderhoud: 'Onderhoud',
  onderdelen: 'Onderdelen',
  vraag: 'Vraag / documentatie',
};
export const TYPES = Object.keys(TYPE_LABEL) as TicketType[];

export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Laag',
  2: 'Normaal',
  3: 'Hoog',
  4: 'Machine staat stil',
};

export const DOC_CATEGORY_LABEL: Record<string, string> = {
  handleiding: 'Handleiding',
  tekening: 'Tekening',
  schema: 'Elektrisch schema',
  stuklijst: 'Stuklijst',
  servicerapport: 'Servicerapport',
  certificaat: 'Certificaat',
  overig: 'Overig',
};

/**
 * Fluidor Service & Maintenance Program: jaar 1 optimalisatie,
 * daarna afwisselend Minor en Major inspection (jaar 2 t/m 6).
 */
export const MAINTENANCE_CYCLE = [
  'Optimalisatie',
  'Minor inspection',
  'Major inspection',
  'Minor inspection',
  'Major inspection',
  'Minor inspection',
];

export function contractYear(contractStart: string | null, today = new Date()): number | null {
  if (!contractStart) return null;
  const start = new Date(contractStart);
  const years = (today.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.min(6, Math.max(1, Math.floor(years) + 1));
}

const TZ = 'Europe/Amsterdam';
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}
export function fmtAge(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (hours < 1) return 'zojuist';
  if (hours < 24) return `${Math.floor(hours)} u`;
  return `${Math.floor(hours / 24)} d`;
}
export function fmtDuration(hours: number | null): string {
  if (hours == null || Number.isNaN(hours)) return '–';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1).replace('.', ',')} u`;
  return `${Math.round(hours / 24)} d`;
}
export function fmtBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
