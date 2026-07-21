import Image from "next/image";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <span className="inline-flex items-center gap-2.5 font-extrabold tracking-tight text-[var(--primary)]">
    <Image src="/brand/clockin-mark.png" alt="" width={44} height={44} className="size-11 object-contain" />
    {!compact && <span className="text-xl" dir="ltr">ClockIn</span>}
  </span>;
}