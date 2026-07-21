import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";
import { DEMO_USER, isDemoMode } from "@/lib/demo";

export const getSessionUser = cache(async () => {
  if (isDemoMode()) return DEMO_USER;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
