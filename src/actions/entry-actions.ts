"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { timeEntrySchema } from "@/lib/validation/schemas";
import { isDemoMode } from "@/lib/demo";

export async function saveEntry(formData: FormData) {
  const parsed = timeEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  if (isDemoMode()) { revalidatePath("/app/entries"); return { ok: true, message: "הדיווח נשמר לצורך ההדגמה" }; }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "נדרשת כניסה מחדש" };
  const row = { user_id: user.id, clock_in: parsed.data.clockIn, clock_out: parsed.data.clockOut, note: parsed.data.note, edit_reason: parsed.data.reason, category_id: parsed.data.categoryId, source: "manual" };
  const query = parsed.data.id ? supabase.from("time_entries").update(row).eq("id", parsed.data.id).eq("user_id", user.id) : supabase.from("time_entries").insert(row);
  const { error } = await query;
  if (error) return { ok: false, message: error.message.includes("overlap") ? "הדיווח חופף לדיווח קיים" : "לא ניתן לשמור את הדיווח" };
  revalidatePath("/app/entries");
  revalidatePath("/app/report");
  return { ok: true, message: "השינויים נשמרו" };
}

export async function deleteEntry(id: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_time_entry", { entry_id: id, delete_reason: reason });
  if (error) return { ok: false, message: "לא ניתן למחוק את הדיווח" };
  revalidatePath("/app/entries");
  return { ok: true, message: "הדיווח נמחק" };
}
