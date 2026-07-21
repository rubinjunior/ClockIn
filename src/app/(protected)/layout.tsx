import { Navigation } from "@/components/app-shell/navigation";
import { OnlineStatus } from "@/components/app-shell/online-status";
import { isDemoMode } from "@/lib/demo";
export default function ProtectedLayout({ children }: { children: React.ReactNode }) { return <div className="min-h-dvh md:pe-[17rem]"><OnlineStatus/>{isDemoMode() && <div role="status" className="no-print fixed inset-x-0 top-0 z-30 bg-[var(--warning-soft)] px-4 py-2 text-center text-xs font-bold text-[var(--warning)]">מצב הדגמה · הנתונים זמניים ואינם נשמרים</div>}<Navigation/><main id="main-content" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-12 sm:px-6 md:pb-10 md:pt-12">{children}</main></div>; }
