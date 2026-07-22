import { Navigation } from "@/components/app-shell/navigation";
import { OnlineStatus } from "@/components/app-shell/online-status";
import { DebugOverlay } from "@/components/debug/debug-overlay";
import { canViewDebug } from "@/lib/auth/roles";
import { isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
  let debugEnabled = demoMode;

  if (!demoMode) {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    debugEnabled = canViewDebug(profile?.role);
  }

  return (
    <div className="min-h-dvh md:pe-[17rem]">
      <OnlineStatus />
      {demoMode && <div role="status" className="no-print fixed inset-x-0 top-0 z-30 bg-[var(--warning-soft)] px-4 py-2 text-center text-xs font-bold text-[var(--warning)]">מצב הדגמה · הנתונים זמניים ואינם נשמרים</div>}
      <Navigation />
      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-12 sm:px-6 md:pb-10 md:pt-12">{children}</main>
      <DebugOverlay enabled={debugEnabled} />
    </div>
  );
}