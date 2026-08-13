"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { FileChartColumn, Home, Logs, Settings } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { he } from "@/lib/i18n/he";

function NavPending() {
  const { pending } = useLinkStatus();
  return <span className={`nav-pending${pending ? " is-pending" : ""}`} aria-hidden><i /><i /><i /></span>;
}

const items = [
  { href: "/app", label: he.nav.home, icon: Home },
  { href: "/app/entries", label: he.nav.entries, icon: Logs },
  { href: "/app/report", label: he.nav.report, icon: FileChartColumn },
  { href: "/app/settings", label: he.nav.settings, icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label={he.nav.mainLabel} className="app-bottom-nav no-print lg:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className="app-bottom-nav-link">
              <span className="app-bottom-nav-icon"><Icon aria-hidden size={20} strokeWidth={active ? 2.35 : 2} /></span>
              <span>{label}</span>
              <NavPending />
            </Link>
          );
        })}
      </nav>

      <aside className="app-sidebar no-print">
        <Link href="/app" aria-label={he.nav.brandHome} className="app-sidebar-brand"><Logo /></Link>
        <div className="app-sidebar-divider" />
        <nav aria-label={he.nav.mainLabel} className="app-sidebar-nav">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/app" ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className="app-sidebar-link">
                <Icon aria-hidden size={20} strokeWidth={active ? 2.35 : 2} />
                <span>{label}</span>
                <NavPending />
              </Link>
            );
          })}
        </nav>
        <p className="app-sidebar-caption">{he.nav.secureCaption}</p>
      </aside>
    </>
  );
}
