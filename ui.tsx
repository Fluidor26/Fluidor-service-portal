import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/labels';
import type { TicketStatus } from '@/lib/types';

export function StatusChip({ status }: { status: TicketStatus }) {
  return <span className={`chip st-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Priority({ value }: { value: number }) {
  return <span className={`pr p${value}`}>{PRIORITY_LABEL[value]}</span>;
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'err' | 'ok'; children: React.ReactNode }) {
  return <div className={`notice ${kind === 'info' ? '' : kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</div>;
}

/** Toont ?fout= of ?ok= uit de URL na een formulieractie. */
export function FlashFromParams({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const err = typeof searchParams?.fout === 'string' ? searchParams.fout : null;
  const ok = typeof searchParams?.ok === 'string' ? searchParams.ok : null;
  if (err) return <Notice kind="err">{err}</Notice>;
  if (ok) return <Notice kind="ok">{ok}</Notice>;
  return null;
}

export function initials(name: string | null | undefined) {
  return (name || '?')
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
