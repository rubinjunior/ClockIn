import { Navigation } from "@/components/app-shell/navigation";
import { OnlineStatus } from "@/components/app-shell/online-status";
import { DebugOverlay } from "@/components/debug/debug-overlay";
import { canViewDebug } from "@/lib/auth/roles";
import { isDemoMode } from "@/lib/demo";
import { getCurrentProfile } from "@/lib/supabase/profile";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
  let debugEnabled = demoMode;

  if (!demoMode) {
    const profile = await getCurrentProfile();
    debugEnabled = canViewDebug(profile.role);
  }

  return (
    <div className="min-h-dvh">
      <OnlineStatus />
      {demoMode && <div role="status" className="no-print fixed inset-x-0 top-0 z-30 bg-[var(--warning-soft)] px-4 py-2 text-center text-xs font-bold text-[var(--warning)]">מצב הדגמה · הנתונים זמניים ואינם נשמרים</div>}
      <Navigation />
      <div className="lg:ps-[15rem]">
        <main id="main-content" className="app-main mx-auto w-full max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:pb-10 lg:pt-12">{children}</main>
      </div>
      <DebugOverlay enabled={debugEnabled} />
    </div>
  );
}