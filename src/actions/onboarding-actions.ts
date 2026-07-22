"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { he } from "@/lib/i18n/he";
import { createClient } from "@/lib/supabase/server";
import { minutesBetween } from "@/lib/time/calculations";
import { normalizeUsername, usernameSchema } from "@/lib/validation/schemas";

export type OnboardingDebugEvent = { status: "ok" | "error"; message: string };
export type OnboardingState = { error?: string; events: OnboardingDebugEvent[] };

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, he.validation.time);
const optionalAmount = z.preprocess(
  (value) => value === "" || value == null ? undefined : value,
  z.coerce.number().min(0).max(100000000).optional(),
);
const onboardingSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().max(100).optional(),
  timezone: z.enum(["Asia/Jerusalem", "Europe/London", "America/New_York"]),
  startTime: timeSchema,
  endTime: timeSchema,
  compensationMode: z.enum(["hidden", "hourly", "global"]),
  hourlyRate: optionalAmount,
  monthlySalary: optionalAmount,
  vacationBalance: z.coerce.number().min(0).max(10000),
  sickBalance: z.coerce.number().min(0).max(10000),
  clockInReminder: timeSchema,
  clockOutReminder: timeSchema,
}).superRefine((value, context) => {
  if (value.compensationMode === "hourly" && !value.hourlyRate) context.addIssue({ code: "custom", path: ["hourlyRate"], message: he.validation.hourlyRate });
  if (value.compensationMode === "global" && !value.monthlySalary) context.addIssue({ code: "custom", path: ["monthlySalary"], message: he.validation.monthlySalary });
  if (!minutesBetween(value.startTime, value.endTime)) context.addIssue({ code: "custom", path: ["endTime"], message: he.validation.workRange });
});

function failed(events: OnboardingDebugEvent[], message: string, code?: string): OnboardingState {
  console.error("[onboarding]", message, code ? { code } : undefined);
  return { error: message, events: [...events, { status: "error", message }] };
}

export async function completeOnboarding(_: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const events: OnboardingDebugEvent[] = [];
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed(events, parsed.error.issues[0]?.message ?? he.onboarding.saveFailed);

  const values = parsed.data;
  const targetMinutes = minutesBetween(values.startTime, values.endTime);
  const notifications = formData.get("notifications") === "on";
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return failed(events, he.onboarding.loginAgain, authError?.code);
  events.push({ status: "ok", message: he.onboarding.debugAuthenticated });

  const scheduleResult = await supabase.from("work_schedule_versions").select("id").order("effective_from", { ascending: false }).limit(1).maybeSingle();
  if (scheduleResult.error) return failed(events, he.onboarding.scheduleFailed, scheduleResult.error.code);

  let scheduleId = scheduleResult.data?.id;
  if (scheduleId) {
    const update = await supabase.from("work_schedule_versions").update({ name: "שגרת עבודה" }).eq("id", scheduleId);
    if (update.error) return failed(events, he.onboarding.scheduleFailed, update.error.code);
  } else {
    const insert = await supabase.from("work_schedule_versions").insert({ user_id: user.id, name: "שגרת עבודה", effective_from: today }).select("id").single();
    if (insert.error) return failed(events, he.onboarding.scheduleFailed, insert.error.code);
    scheduleId = insert.data.id;
  }

  const scheduleDays = await supabase.from("work_schedule_days").upsert(
    Array.from({ length: 7 }, (_, weekday) => ({
      schedule_version_id: scheduleId!,
      weekday,
      is_workday: weekday <= 4,
      expected_start_time: weekday <= 4 ? values.startTime : null,
      expected_end_time: weekday <= 4 ? values.endTime : null,
      target_minutes: weekday <= 4 ? targetMinutes : 0,
    })),
    { onConflict: "schedule_version_id,weekday" },
  );
  if (scheduleDays.error) return failed(events, he.onboarding.scheduleFailed, scheduleDays.error.code);
  events.push({ status: "ok", message: he.onboarding.debugScheduleSaved });

  const termValues = {
    compensation_enabled: values.compensationMode !== "hidden",
    mode: values.compensationMode,
    hourly_rate: values.compensationMode === "hourly" ? values.hourlyRate : null,
    monthly_salary: values.compensationMode === "global" ? values.monthlySalary : null,
    currency: "ILS",
  };
  const existingTerm = await supabase.from("employment_terms").select("id").order("effective_from", { ascending: false }).limit(1).maybeSingle();
  if (existingTerm.error) return failed(events, he.onboarding.compensationFailed, existingTerm.error.code);
  const termResult = existingTerm.data
    ? await supabase.from("employment_terms").update(termValues).eq("id", existingTerm.data.id)
    : await supabase.from("employment_terms").insert({ user_id: user.id, effective_from: today, ...termValues });
  if (termResult.error) return failed(events, he.onboarding.compensationFailed, termResult.error.code);
  events.push({ status: "ok", message: he.onboarding.debugCompensationSaved });

  const balances = await supabase.from("leave_balance_adjustments").select("leave_type,minutes");
  if (balances.error) return failed(events, he.onboarding.balancesFailed, balances.error.code);
  for (const leaveType of ["vacation", "sick"] as const) {
    const desired = Math.round((leaveType === "vacation" ? values.vacationBalance : values.sickBalance) * targetMinutes);
    const current = (balances.data ?? []).filter((row) => row.leave_type === leaveType).reduce((sum, row) => sum + Number(row.minutes), 0);
    const difference = desired - current;
    if (difference) {
      const adjustment = await supabase.from("leave_balance_adjustments").insert({
        user_id: user.id,
        leave_type: leaveType,
        minutes: difference,
        effective_date: today,
        reason: current ? "תיקון יתרת פתיחה" : "יתרת פתיחה",
      });
      if (adjustment.error) return failed(events, he.onboarding.balancesFailed, adjustment.error.code);
    }
  }
  events.push({ status: "ok", message: he.onboarding.debugBalancesSaved });

  const reminders = await supabase.from("reminder_settings").upsert([
    { user_id: user.id, reminder_type: "clock_in", enabled: notifications, local_time: values.clockInReminder, weekdays: [0,1,2,3,4], timezone: values.timezone },
    { user_id: user.id, reminder_type: "clock_out", enabled: notifications, local_time: values.clockOutReminder, weekdays: [0,1,2,3,4], timezone: values.timezone },
  ], { onConflict: "user_id,reminder_type" });
  if (reminders.error) return failed(events, he.onboarding.remindersFailed, reminders.error.code);
  events.push({ status: "ok", message: he.onboarding.debugRemindersSaved });

  const profile = await supabase.from("profiles").update({
    username: values.username,
    normalized_username: normalizeUsername(values.username),
    full_name: values.fullName || null,
    timezone: values.timezone,
    locale: "he-IL",
    onboarding_completed_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (profile.error) return failed(events, he.onboarding.profileFailed, profile.error.code);
  events.push({ status: "ok", message: he.onboarding.debugProfileSaved });

  redirect("/app");
}
