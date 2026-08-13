"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { he } from "@/lib/i18n/he";
import { isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

const vacationSchema = z.object({
  id: z.preprocess((value) => value === "" || value == null ? undefined : value, z.uuid().optional()),
  date: z.iso.date(),
  duration: z.enum(["full", "partial"]),
  partialHours: z.preprocess((value) => value === "" || value == null ? null : value, z.coerce.number().positive().max(24).nullable()),
  note: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.duration === "partial" && value.partialHours == null) {
    context.addIssue({ code: "custom", path: ["partialHours"], message: "partial_hours_required" });
  }
});

const cancelSchema = z.object({ id: z.uuid() });

function refreshReportViews() {
  revalidatePath("/app");
  revalidatePath("/app/report");
  revalidatePath("/app/settings");
}

export async function saveReportVacation(formData: FormData) {
  const parsed = vacationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: he.report.vacationInvalid };
  if (isDemoMode()) {
    refreshReportViews();
    return { ok: true, message: he.report.vacationSavedDemo };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: he.auth.sessionExpired };

  const partialMinutes = parsed.data.duration === "partial"
    ? Math.round((parsed.data.partialHours ?? 0) * 60)
    : null;
  const values = { partial_minutes: partialMinutes, note: parsed.data.note || null };
  const query = parsed.data.id
    ? supabase.from("leave_entries").update(values).eq("id", parsed.data.id).eq("user_id", user.id).eq("leave_type", "vacation").eq("status", "approved")
    : supabase.from("leave_entries").insert({
        user_id: user.id,
        leave_type: "vacation",
        start_date: parsed.data.date,
        end_date: parsed.data.date,
        partial_minutes: partialMinutes,
        status: "approved",
        note: parsed.data.note || null,
      });
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      message: error?.message.includes("leave_entry_overlap") ? he.report.vacationOverlap : he.report.vacationSaveFailed,
    };
  }
  refreshReportViews();
  return { ok: true, message: he.report.vacationSaved };
}

export async function cancelReportVacation(id: string) {
  const parsed = cancelSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, message: he.report.vacationCancelFailed };
  if (isDemoMode()) {
    refreshReportViews();
    return { ok: true, message: he.report.vacationCancelledDemo };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: he.auth.sessionExpired };
  const { data, error } = await supabase.from("leave_entries")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("leave_type", "vacation")
    .eq("status", "approved")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: he.report.vacationCancelFailed };
  refreshReportViews();
  return { ok: true, message: he.report.vacationCancelled };
}
