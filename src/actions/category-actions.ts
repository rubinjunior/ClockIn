"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDemoMode } from "@/lib/demo";
import { he } from "@/lib/i18n/he";
import { createClient } from "@/lib/supabase/server";

export type CategoryActionState = { ok?: boolean; message?: string };

const categorySchema = z.object({
  id: z.preprocess((value) => value === "" ? undefined : value, z.uuid().optional()),
  name: z.string().trim().min(1, he.categories.nameRequired).max(40, he.categories.nameTooLong),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function saveWorkCategory(_: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? he.categories.saveFailed };
  if (isDemoMode()) return { ok: true, message: he.categories.saved };

  const auth = await authenticatedClient();
  if (!auth) return { ok: false, message: he.onboarding.loginAgain };

  const values = { name: parsed.data.name, is_active: true };
  const query = parsed.data.id
    ? auth.supabase.from("work_categories").update(values).eq("id", parsed.data.id).eq("user_id", auth.user.id)
    : auth.supabase.from("work_categories").insert({ ...values, user_id: auth.user.id });
  const { error } = await query;
  if (error) return { ok: false, message: error.code === "23505" ? he.categories.duplicate : he.categories.saveFailed };

  revalidatePath("/app/settings");
  revalidatePath("/app/entries");
  revalidatePath("/app/report");
  return { ok: true, message: he.categories.saved };
}

export async function archiveWorkCategory(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success || isDemoMode()) return;

  const auth = await authenticatedClient();
  if (!auth) return;
  await auth.supabase.from("work_categories").update({ is_active: false }).eq("id", id.data).eq("user_id", auth.user.id);
  revalidatePath("/app/settings");
  revalidatePath("/app/entries");
  revalidatePath("/app/report");
}