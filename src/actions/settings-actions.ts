"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, usernameSchema } from "@/lib/validation/schemas";
import { isDemoMode } from "@/lib/demo";
import { israelToday } from "@/lib/time/israel";

const dateSchema = z.iso.date();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalNumber = z.preprocess((value) => value === "" || value == null ? null : value, z.coerce.number().min(0).nullable());

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function finish(result: string): never {
  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath("/app/report");
  redirect("/app/settings?result=" + encodeURIComponent(result));
}

export async function saveProfile(formData: FormData) {
  const parsed = z.object({ username: usernameSchema, fullName: z.string().trim().max(100).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("profile_invalid");
  if (isDemoMode()) finish("profile_saved");
  const { supabase, user } = await auth();
  const { error } = await supabase.from("profiles").update({ username: parsed.data.username, normalized_username: normalizeUsername(parsed.data.username), full_name: parsed.data.fullName || null, timezone: "Asia/Jerusalem", locale: "he-IL" }).eq("id", user.id);
  finish(error ? (error.code === "23505" ? "username_taken" : "profile_error") : "profile_saved");
}

export async function createSchedule(formData: FormData) {
  const parsed = z.object({ name: z.string().trim().min(2).max(80), effectiveFrom: dateSchema, startTime: timeSchema, endTime: timeSchema, workdays: z.array(z.coerce.number().int().min(0).max(6)).min(1) }).superRefine((value, context) => {
    if (value.endTime <= value.startTime) context.addIssue({ code: "custom", path: ["endTime"], message: "invalid_range" });
  }).safeParse({ ...Object.fromEntries(formData), workdays: formData.getAll("workdays") });
  if (!parsed.success) finish("schedule_invalid");
  if (isDemoMode()) finish("schedule_saved");
  const { supabase } = await auth();
  const { error } = await supabase.rpc("create_work_schedule", { schedule_name: parsed.data.name, starts_on: parsed.data.effectiveFrom, start_at: parsed.data.startTime, end_at: parsed.data.endTime, workdays: parsed.data.workdays });
  finish(error ? "schedule_error" : "schedule_saved");
}

export async function saveCompensation(formData: FormData) {
  const parsed = z.object({ effectiveFrom: dateSchema, mode: z.enum(["hidden", "hourly", "global"]), hourlyRate: optionalNumber, monthlySalary: optionalNumber }).superRefine((value, context) => {
    if (value.mode === "hourly" && value.hourlyRate == null) context.addIssue({ code: "custom", path: ["hourlyRate"], message: "rate_required" });
    if (value.mode === "global" && value.monthlySalary == null) context.addIssue({ code: "custom", path: ["monthlySalary"], message: "salary_required" });
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("compensation_invalid");
  if (isDemoMode()) finish("compensation_saved");
  const { supabase } = await auth();
  const { error } = await supabase.rpc("create_employment_term", { starts_on: parsed.data.effectiveFrom, compensation_mode: parsed.data.mode, rate: parsed.data.hourlyRate, salary: parsed.data.monthlySalary });
  finish(error ? "compensation_error" : "compensation_saved");
}

export async function addLeave(formData: FormData) {
  const parsed = z.object({ leaveType: z.enum(["vacation", "sick"]), startDate: dateSchema, endDate: dateSchema, partialMinutes: z.preprocess((value) => value === "" || value == null ? null : value, z.coerce.number().int().min(1).max(1440).nullable()), note: z.string().trim().max(500).optional() }).refine((value) => value.endDate >= value.startDate, { path: ["endDate"], message: "invalid_range" }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("leave_invalid");
  if (isDemoMode()) finish("leave_saved");
  const { supabase, user } = await auth();
  const { error } = await supabase.from("leave_entries").insert({ user_id: user.id, leave_type: parsed.data.leaveType, start_date: parsed.data.startDate, end_date: parsed.data.endDate, partial_minutes: parsed.data.partialMinutes, status: "approved", note: parsed.data.note || null });
  finish(error ? (error.message.includes("leave_entry_overlap") ? "leave_overlap" : "leave_error") : "leave_saved");
}

export async function deleteLeave(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) finish("leave_error");
  if (isDemoMode()) finish("leave_deleted");
  const { supabase, user } = await auth();
  const { error } = await supabase.from("leave_entries").update({ status: "cancelled" }).eq("id", id.data).eq("user_id", user.id);
  finish(error ? "leave_error" : "leave_deleted");
}

export async function addException(formData: FormData) {
  const parsed = z.object({ date: dateSchema, type: z.enum(["holiday", "shortened", "day_off", "special_workday"]), name: z.string().trim().min(2).max(100), targetMinutes: z.preprocess((value) => value === "" || value == null ? null : value, z.coerce.number().int().min(0).max(1440).nullable()), note: z.string().trim().max(500).optional() }).superRefine((value, context) => {
    if (["shortened", "special_workday"].includes(value.type) && value.targetMinutes == null) context.addIssue({ code: "custom", path: ["targetMinutes"], message: "minutes_required" });
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("exception_invalid");
  if (isDemoMode()) finish("exception_saved");
  const { supabase, user } = await auth();
  const { error } = await supabase.from("calendar_exceptions").upsert({ user_id: user.id, exception_date: parsed.data.date, exception_type: parsed.data.type, name: parsed.data.name, target_minutes: parsed.data.targetMinutes, note: parsed.data.note || null }, { onConflict: "user_id,exception_date" });
  finish(error ? "exception_error" : "exception_saved");
}

export async function deleteException(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) finish("exception_error");
  if (isDemoMode()) finish("exception_deleted");
  const { supabase, user } = await auth();
  const { error } = await supabase.from("calendar_exceptions").delete().eq("id", id.data).eq("user_id", user.id);
  finish(error ? "exception_error" : "exception_deleted");
}

export async function saveReminders(formData: FormData) {
  const parsed = z.object({ clockInTime: timeSchema, clockOutTime: timeSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("reminders_invalid");
  if (isDemoMode()) finish("reminders_saved");
  const { supabase, user } = await auth();
  const today = israelToday();
  const scheduleResult = await supabase.from("work_schedule_versions").select("work_schedule_days(weekday,is_workday)").lte("effective_from", today).or(`effective_to.is.null,effective_to.gte.${today}`).order("effective_from", { ascending: false }).limit(1).maybeSingle();
  if (scheduleResult.error) finish("reminders_error");
  const weekdays = scheduleResult.data?.work_schedule_days.filter((day) => day.is_workday).map((day) => day.weekday) ?? [0,1,2,3,4];
  const { error } = await supabase.from("reminder_settings").upsert([
    { user_id: user.id, reminder_type: "clock_in", enabled: formData.get("clockInEnabled") === "on", local_time: parsed.data.clockInTime, weekdays, timezone: "Asia/Jerusalem" },
    { user_id: user.id, reminder_type: "clock_out", enabled: formData.get("clockOutEnabled") === "on", local_time: parsed.data.clockOutTime, weekdays, timezone: "Asia/Jerusalem" },
  ], { onConflict: "user_id,reminder_type" });
  finish(error ? "reminders_error" : "reminders_saved");
}