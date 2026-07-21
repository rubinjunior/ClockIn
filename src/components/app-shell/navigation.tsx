"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Logs, Settings, FileChartColumn } from "lucide-react";
import { he } from "@/lib/i18n/he";
import { Logo } from "@/components/shared/logo";
const items = [{ href: "/app", label: he.nav.home, icon: Home }, { href: "/app/entries", label: he.nav.entries, icon: Logs }, { href: "/app/report", label: he.nav.report, icon: FileChartColumn }, { href: "/app/settings", label: he.nav.settings, icon: Settings }];

export function Navigation() {
  const pathname = usePathname();
  return <>
    <nav aria-label="ניווט ראשי" className="glass fixed inset-x-3 bottom-3 z-40 flex h-[72px] items-center justify-around rounded-[24px] px-2 pb-[env(safe-area-inset-bottom)] md:hidden">{items.map(({ href, label, icon: Icon }) => { const active = href === "/app" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition-colors ${active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--text-secondary)] hover:text-[var(--primary)]"}`}><Icon aria-hidden size={21}/><span>{label}</span></Link>; })}</nav>
    <aside className="no-print glass fixed inset-block-4 inset-inline-start-4 hidden w-60 flex-col rounded-[28px] p-4 md:flex"><Link href="/app" aria-label="ClockIn – דף הבית" className="mb-8 px-2"><Logo /></Link><nav aria-label="ניווט ראשי" className="grid gap-2">{items.map(({ href, label, icon: Icon }) => { const active = href === "/app" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold transition-colors ${active ? "bg-[var(--primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"}`}><Icon aria-hidden size={21}/>{label}</Link>; })}</nav><p className="muted mt-auto px-3 text-xs">מעקב אישי ומאובטח</p></aside>
  </>;
}
