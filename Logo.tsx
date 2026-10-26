export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 15c3-5 7 3 14-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
