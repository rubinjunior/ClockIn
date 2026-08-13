function ClockMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="size-full" fill="none">
      <circle cx="20" cy="20" r="17.25" fill="var(--primary-soft)" />
      <path d="M28.9 8.5a14 14 0 1 0 .2 22.8" stroke="currentColor" strokeWidth="3.25" strokeLinecap="round" />
      <path d="M20 11.8v8.7l6.1 3.65" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20.5" r="2.15" fill="currentColor" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[var(--primary)]">
      <span className="size-10 shrink-0" aria-hidden="true"><ClockMark /></span>
      {!compact && <span className="text-[1.18rem] font-extrabold leading-none tracking-[-0.035em]" dir="ltr">Clock<span className="text-[var(--accent)]">In</span></span>}
    </span>
  );
}
