"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authSchema, normalizeUsername, registrationSchema } from "@/lib/validation/schemas";
import { isDemoMode } from "@/lib/demo";

export type ActionState = { error?: string; success?: string };

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  if (isDemoMode()) redirect("/app");
  const parsed = authSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "הדואר האלקטרוני או הסיסמה אינם נכונים" };
  redirect("/app");
}

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data: available } = await supabase.rpc("is_username_available", { candidate: parsed.data.username });
  if (!available) return { error: "שם המשתמש כבר תפוס" };
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/onboarding`,
      data: { username: parsed.data.username, normalized_username: normalizeUsername(parsed.data.username) },
    },
  });
  if (error) return { error: "לא ניתן ליצור את החשבון. כדאי לנסות שוב." };
  if (!data.session) return { success: "שלחנו אליך קישור לאישור החשבון. לאחר האישור אפשר להיכנס." };
  redirect("/onboarding");
}

export async function forgotPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  if (!authSchema.shape.email.safeParse(email).success) return { error: "יש להזין כתובת דואר תקינה" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password` });
  return { success: "אם קיים חשבון מתאים, נשלח אליו קישור לאיפוס הסיסמה" };
}

export async function logoutAction() {
  if (isDemoMode()) redirect("/app");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
