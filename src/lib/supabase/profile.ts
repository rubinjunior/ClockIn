import { cache } from "react";
import { DEMO_USER, isDemoMode } from "@/lib/demo";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { requireUser } from "@/lib/supabase/session";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  username: string;
  full_name: string | null;
  timezone: string;
  locale: string;
  role: "user" | "admin";
  onboarding_completed_at: string | null;
};

// Request-scoped deduplication only. Private profile data is never persisted in
// a shared server, CDN, or service-worker cache.
export const getCurrentProfile = cache(async (): Promise<CurrentProfile> => {
  if (isDemoMode()) {
    return {
      username: DEMO_USER.user_metadata.username,
      full_name: "נועה ישראלי",
      timezone: "Asia/Jerusalem",
      locale: "he-IL",
      role: "admin",
      onboarding_completed_at: new Date(0).toISOString(),
    };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const result = await supabase
    .from("profiles")
    .select("username,full_name,timezone,locale,role,onboarding_completed_at")
    .eq("id", user.id)
    .single();
  requireSuccessfulQueries("current-profile", [result]);
  return result.data as CurrentProfile;
});