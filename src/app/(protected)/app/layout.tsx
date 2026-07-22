import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { requireUser } from "@/lib/supabase/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) {
    const user = await requireUser();
    const supabase = await createClient();
    const profileResult = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .single();
    requireSuccessfulQueries("app-profile", [profileResult]);

    if (!profileResult.data?.onboarding_completed_at) redirect("/onboarding");
  }

  return children;
}
