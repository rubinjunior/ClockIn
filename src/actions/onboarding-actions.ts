"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema, normalizeUsername } from "@/lib/validation/schemas";

export async function completeOnboarding(formData: FormData) {
  const username = usernameSchema.parse(String(formData.get("username") ?? ""));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("נדרשת כניסה מחדש");
  const today = new Date().toISOString().slice(0, 10);
  const profileResult = await supabase.from("profiles").update({ username, normalized_username: normalizeUsername(username), full_name: String(formData.get("fullName") ?? "") || null, timezone: String(formData.get("timezone") ?? "Asia/Jerusalem"), locale: "he-IL", onboarding_completed_at: new Date().toISOString() }).eq("id", user.id);
  if (profileResult.error) throw new Error("לא ניתן לשמור את הפרופיל");
  const { data: schedule, error: scheduleError } = await supabase.from("work_schedule_versions").insert({ user_id: user.id, name: "שגרת עבודה", effective_from: today }).select("id").single();
  if (!scheduleError && schedule) await supabase.from("work_schedule_days").insert(Array.from({ length: 7 }, (_, weekday) => ({ schedule_version_id: schedule.id, weekday, is_workday: weekday <= 4, expected_start_time: weekday <= 4 ? String(formData.get("startTime") ?? "08:30") : null, expected_end_time: weekday <= 4 ? String(formData.get("endTime") ?? "17:00") : null, target_minutes: weekday <= 4 ? Number(formData.get("targetMinutes") ?? 510) : 0 })));
  const mode = String(formData.get("compensationMode") ?? "hidden");
  await supabase.from("employment_terms").insert({ user_id: user.id, effective_from: today, compensation_enabled: mode !== "hidden", mode, hourly_rate: mode === "hourly" ? Number(formData.get("hourlyRate") ?? 0) : null, monthly_salary: mode === "global" ? Number(formData.get("monthlySalary") ?? 0) : null, currency: "ILS" });
  await supabase.from("leave_balance_adjustments").insert([{ user_id: user.id, leave_type: "vacation", minutes: Number(formData.get("vacationBalance") ?? 0) * 510, effective_date: today, reason: "יתרת פתיחה" }, { user_id: user.id, leave_type: "sick", minutes: Number(formData.get("sickBalance") ?? 0) * 510, effective_date: today, reason: "יתרת פתיחה" }]);
  await supabase.from("reminder_settings").upsert([{ user_id: user.id, reminder_type: "clock_in", enabled: formData.get("notifications") === "on", local_time: String(formData.get("clockInReminder") ?? "08:25"), weekdays: [0,1,2,3,4], timezone: "Asia/Jerusalem" }, { user_id: user.id, reminder_type: "clock_out", enabled: formData.get("notifications") === "on", local_time: String(formData.get("clockOutReminder") ?? "17:05"), weekdays: [0,1,2,3,4], timezone: "Asia/Jerusalem" }], { onConflict: "user_id,reminder_type" });
  redirect("/app");
}
