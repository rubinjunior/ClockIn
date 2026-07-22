"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { timeEntrySchema } from "@/lib/validation/schemas";
import { isDemoMode } from "@/lib/demo";

const deleteSchema = z.object({ id: z.uuid(), reason: z.string().trim().min(3).max(250) });

function revalidateEntryViews() {
  revalidatePath("/app");
  revalidatePath("/app/entries");
  revalidatePath("/app/report");
}

export async function saveEntry(formData: FormData) {
  const parsed = timeEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  if (isDemoMode()) { revalidateEntryViews(); return { ok: true, message: "הדיווח נשמר לצורך ההדגמה" }; }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "נדרשת כניסה מחדש" };
  const row = { user_id: user.id, clock_in: parsed.data.clockIn, clock_out: parsed.data.clockOut, note: parsed.data.note || null, edit_reason: parsed.data.reason, category_id: parsed.data.categoryId, source: "manual" };
  const query = parsed.data.id
    ? supabase.from("time_entries").update(row).eq("id", parsed.data.id).eq("user_id", user.id)
    : supabase.from("time_entries").insert(row);
  const { error } = await query;
  if (error) {
    if (error.message.includes("overlap")) return { ok: false, message: "הדיווח חופף לדיווח קיים" };
    if (error.message.includes("future_time_entry")) return { ok: false, message: "לא ניתן להזין שעות עתידיות" };
    return { ok: false, message: "לא ניתן לשמור את הדיווח" };
  }
  revalidateEntryViews();
  return { ok: true, message: "השינויים נשמרו" };
}

export async function deleteEntry(id: string, reason: string) {
  const parsed = deleteSchema.safeParse({ id, reason });
  if (!parsed.success) return { ok: false, message: "יש לציין סיבת מחיקה" };
  if (isDemoMode()) { revalidateEntryViews(); return { ok: true, message: "הדיווח נמחק לצורך ההדגמה" }; }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "נדרשת כניסה מחדש" };
  const { error } = await supabase.rpc("soft_delete_time_entry", { entry_id: parsed.data.id, delete_reason: parsed.data.reason });
  if (error) return { ok: false, message: "לא ניתן למחוק את הדיווח" };
  revalidateEntryViews();
  return { ok: true, message: "הדיווח נמחק" };
}