import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo";
import { getCurrentProfile } from "@/lib/supabase/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) {
    const profile = await getCurrentProfile();
    if (!profile.onboarding_completed_at) redirect("/onboarding");
  }

  return children;
}
