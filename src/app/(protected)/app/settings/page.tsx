import { formatInTimeZone } from "date-fns-tz";
import { LogOut, Trash2 } from "lucide-react";
import { logoutAction } from "@/actions/auth-actions";
import { addException, addLeave, createSchedule, deleteException, deleteLeave, saveCompensation, saveProfile, saveReminders } from "@/actions/settings-actions";
import { AccessibilitySettings } from "@/components/settings/accessibility-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { SettingsSubmitButton } from "@/components/settings/settings-submit-button";
import { SettingsHub, type SettingsSection, type SettingsSectionId } from "@/components/settings/settings-hub";
import { WorkCategoriesSettings } from "@/components/settings/work-categories-settings";
import { createClient } from "@/lib/supabase/server";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { requireUser } from "@/lib/supabase/session";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { isDemoMode } from "@/lib/demo";
import { he } from "@/lib/i18n/he";

const feedback: Record<string, { ok: boolean; text: string }> = {
  profile_saved: { ok: true, text: "הפרופיל נשמר" }, profile_invalid: { ok: false, text: "פרטי הפרופיל אינם תקינים" }, profile_error: { ok: false, text: "לא ניתן לשמור את הפרופיל" }, username_taken: { ok: false, text: "שם המשתמש כבר תפוס" },
  schedule_saved: { ok: true, text: "שגרת העבודה נשמרה" }, schedule_invalid: { ok: false, text: "יש לבדוק את ימי ושעות העבודה" }, schedule_error: { ok: false, text: "לא ניתן לשמור את שגרת העבודה" },
  compensation_saved: { ok: true, text: "הגדרת השכר נשמרה" }, compensation_invalid: { ok: false, text: "יש לבדוק את פרטי השכר" }, compensation_error: { ok: false, text: "לא ניתן לשמור את הגדרת השכר" },
  leave_saved: { ok: true, text: "ההיעדרות נשמרה" }, leave_deleted: { ok: true, text: "ההיעדרות בוטלה" }, leave_invalid: { ok: false, text: "פרטי ההיעדרות אינם תקינים" }, leave_overlap: { ok: false, text: "כבר קיימת היעדרות מאושרת בחלק מהתאריכים האלה" }, leave_error: { ok: false, text: "לא ניתן לעדכן את ההיעדרות" },
  exception_saved: { ok: true, text: "היום המיוחד נשמר" }, exception_deleted: { ok: true, text: "היום המיוחד נמחק" }, exception_invalid: { ok: false, text: "פרטי היום המיוחד אינם תקינים" }, exception_error: { ok: false, text: "לא ניתן לעדכן את היום המיוחד" },
  reminders_saved: { ok: true, text: "התזכורות נשמרו" }, reminders_invalid: { ok: false, text: "שעות התזכורת אינן תקינות" }, reminders_error: { ok: false, text: "לא ניתן לשמור את התזכורות" },
};

const resultSections: Record<string, SettingsSectionId> = {
  profile_saved: "profile", profile_invalid: "profile", profile_error: "profile", username_taken: "profile",
  schedule_saved: "schedule", schedule_invalid: "schedule", schedule_error: "schedule",
  compensation_saved: "compensation", compensation_invalid: "compensation", compensation_error: "compensation",
  leave_saved: "leave", leave_deleted: "leave", leave_invalid: "leave", leave_overlap: "leave", leave_error: "leave",
  exception_saved: "exceptions", exception_deleted: "exceptions", exception_invalid: "exceptions", exception_error: "exceptions",
  reminders_saved: "reminders", reminders_invalid: "reminders", reminders_error: "reminders",
};

function isSettingsSection(value: string | undefined): value is SettingsSectionId {
  return ["schedule", "leave", "reminders", "compensation", "exceptions", "profile", "accessibility"].includes(value ?? "");
}
type CategoryRow = { id: string; name: string; is_active: boolean };
type ScheduleDayRow = { weekday: number; is_workday: boolean; expected_start_time: string | null; expected_end_time: string | null; target_minutes: number };
type ScheduleRow = { id: string; name: string; effective_from: string; work_schedule_days: ScheduleDayRow[] };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ newCategory?: string; result?: string; section?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const today = formatInTimeZone(new Date(), "Asia/Jerusalem", "yyyy-MM-dd");
  let profile: { username: string; full_name: string | null } | null;
  let reminders: Array<{ reminder_type: string; enabled: boolean; local_time: string }> | null;
  let terms: { mode: string; hourly_rate: number | null; monthly_salary: number | null; effective_from: string } | null;
  let leaves: Array<{ id: string; leave_type: string; start_date: string; end_date: string }> | null;
  let exceptions: Array<{ id: string; exception_date: string; name: string; exception_type: string; target_minutes: number | null }> | null;
  let categories: CategoryRow[];
  let schedule: ScheduleRow | null;

  if (isDemoMode()) {
    profile = { username: "נועה לדוגמה", full_name: "נועה ישראלי" };
    reminders = [{ reminder_type: "clock_in", enabled: true, local_time: "08:25" }, { reminder_type: "clock_out", enabled: true, local_time: "17:05" }];
    terms = { mode: "hourly", hourly_rate: 62.5, monthly_salary: null, effective_from: today };
    leaves = [];
    exceptions = [];
    categories = [];
    schedule = { id: "demo", name: "שגרת עבודה", effective_from: today, work_schedule_days: Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_workday: weekday <= 4, expected_start_time: weekday <= 4 ? "08:30:00" : null, expected_end_time: weekday <= 4 ? "17:00:00" : null, target_minutes: weekday <= 4 ? 510 : 0 })) };
  } else {
    const [cachedProfile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
    const results = await Promise.all([
      supabase.from("reminder_settings").select("reminder_type,enabled,local_time"),
      supabase.from("employment_terms").select("mode,hourly_rate,monthly_salary,effective_from").order("effective_from", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("leave_entries").select("id,leave_type,start_date,end_date").eq("status", "approved").order("start_date", { ascending: false }).limit(5),
      supabase.from("calendar_exceptions").select("id,exception_date,exception_type,name,target_minutes").order("exception_date", { ascending: false }).limit(8),
      supabase.from("work_categories").select("id,name,is_active").order("sort_order").order("created_at"),
      supabase.from("work_schedule_versions").select("id,name,effective_from,work_schedule_days(weekday,is_workday,expected_start_time,expected_end_time,target_minutes)").order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    ]);
    requireSuccessfulQueries("settings", results);
    profile = cachedProfile;
    reminders = results[0].data;
    terms = results[1].data;
    leaves = results[2].data;
    exceptions = results[3].data;
    categories = results[4].data ?? [];
    schedule = results[5].data as ScheduleRow | null;
  }

  const reminder = (type: string) => reminders?.find((row) => row.reminder_type === type);
  const activeDays = schedule?.work_schedule_days.filter((day) => day.is_workday).sort((a, b) => a.weekday - b.weekday) ?? [];
  const firstDay = activeDays[0];
  const scheduleDescription = activeDays.length ? activeDays.map((day) => ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"][day.weekday]).join(", ") + " · " + firstDay.expected_start_time?.slice(0, 5) + "–" + firstDay.expected_end_time?.slice(0, 5) : "לא הוגדרה שגרת עבודה";
  const notice = params.result ? feedback[params.result] : undefined;

  const initialSection: SettingsSectionId = params.newCategory === "1"
    ? "schedule"
    : resultSections[params.result ?? ""] ?? (isSettingsSection(params.section) ? params.section : "schedule");

  const sections: SettingsSection[] = [
    {
      id: "schedule",
      title: he.settings.schedule,
      description: scheduleDescription,
      summary: he.settings.scheduleSummary,
      content: <div key="schedule" className="grid gap-5">
        <div className="grid grid-cols-7 gap-2 text-center">{he.weekdaysShort.map((day, weekday) => <span key={day} className={"rounded-xl p-3 font-bold " + (activeDays.some((item) => item.weekday === weekday) ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--background)] muted")}>{day}</span>)}</div>
        <p className="muted text-sm">{he.settings.scheduleVersionHint}</p>
        <details open={params.result?.startsWith("schedule_")} className="rounded-2xl border border-[var(--border-soft)] p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold text-[var(--primary)]">{he.settings.createSchedule}</summary>
          <form action={createSchedule} className="mt-4 grid gap-3">
            <Field id="schedule-name" label={he.settings.scheduleName} name="name" defaultValue={schedule?.name ?? he.settings.defaultScheduleName} required />
            <Field id="schedule-effective-from" label={he.settings.effectiveFrom} name="effectiveFrom" type="date" defaultValue={today} required />
            <div className="grid gap-3 sm:grid-cols-2"><Field label={he.settings.startTime} name="startTime" type="time" defaultValue={firstDay?.expected_start_time?.slice(0, 5) ?? "08:30"} required /><Field label={he.settings.endTime} name="endTime" type="time" defaultValue={firstDay?.expected_end_time?.slice(0, 5) ?? "17:00"} required /></div>
            <fieldset><legend className="mb-2 font-bold">{he.settings.workdays}</legend><div className="grid grid-cols-7 gap-2">{he.weekdaysShort.map((day, weekday) => <label key={day} className="grid min-h-14 place-items-center rounded-xl bg-[var(--background)]"><span>{day}</span><input type="checkbox" name="workdays" value={weekday} defaultChecked={activeDays.length ? activeDays.some((item) => item.weekday === weekday) : weekday <= 4} /></label>)}</div></fieldset>
            <SettingsSubmitButton>{he.settings.saveSchedule}</SettingsSubmitButton>
          </form>
        </details>
        <WorkCategoriesSettings categories={categories} autoOpen={params.newCategory === "1"} />
      </div>,
    },
    {
      id: "leave",
      title: he.settings.leave,
      description: he.settings.leaveDescription,
      summary: he.settings.leaveSummary,
      content: <div key="leave" className="grid gap-5">
        <form action={addLeave} className="grid gap-3"><label className="field"><span>{he.settings.leaveType}</span><select className="input" name="leaveType"><option value="vacation">{he.settings.vacation}</option><option value="sick">{he.settings.sick}</option></select></label><div className="grid gap-3 sm:grid-cols-2"><Field label={he.settings.fromDate} name="startDate" type="date" required /><Field label={he.settings.toDate} name="endDate" type="date" required /></div><Field label={he.settings.partialMinutes} name="partialMinutes" type="number" inputMode="numeric" min="1" max="1440" /><Field id="leave-note" label={he.entries.note} name="note" /><SettingsSubmitButton>{he.settings.addLeave}</SettingsSubmitButton></form>
        {leaves?.length ? <div className="grid gap-2"><h3 className="font-bold">{he.settings.recentLeaves}</h3>{leaves.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--background)] p-3 text-sm"><p><b>{row.leave_type === "vacation" ? he.settings.vacation : he.settings.sick}</b> · <span dir="ltr">{row.start_date}–{row.end_date}</span></p><form action={deleteLeave}><input type="hidden" name="id" value={row.id} /><SettingsSubmitButton className="grid size-11 place-items-center rounded-full text-[var(--error)]"><Trash2 aria-hidden size={17} /><span className="sr-only">{he.settings.deleteLeave}</span></SettingsSubmitButton></form></div>)}</div> : <p className="muted rounded-2xl bg-[var(--background)] p-4 text-sm">{he.settings.noLeaves}</p>}
      </div>,
    },
    {
      id: "reminders",
      title: he.settings.reminders,
      description: he.settings.remindersDescription,
      summary: he.settings.remindersSummary,
      content: <div key="reminders" className="grid gap-5"><form action={saveReminders} className="grid gap-3"><Toggle label={he.settings.clockInReminder} name="clockInEnabled" defaultChecked={reminder("clock_in")?.enabled} /><Field label={he.settings.clockInReminderTime} name="clockInTime" type="time" defaultValue={reminder("clock_in")?.local_time?.slice(0, 5) ?? "08:25"} required /><Toggle label={he.settings.clockOutReminder} name="clockOutEnabled" defaultChecked={reminder("clock_out")?.enabled} /><Field label={he.settings.clockOutReminderTime} name="clockOutTime" type="time" defaultValue={reminder("clock_out")?.local_time?.slice(0, 5) ?? "17:05"} required /><SettingsSubmitButton>{he.settings.saveReminders}</SettingsSubmitButton></form><NotificationSettings /></div>,
    },
    {
      id: "compensation",
      title: he.settings.compensation,
      description: he.settings.compensationDescription,
      summary: he.settings.compensationSummary,
      content: <div key="compensation" className="grid gap-5">
        <div className="rounded-2xl bg-[var(--background)] p-4"><p className="muted text-sm">{he.settings.currentState}</p><b>{terms?.mode === "hourly" ? `${he.settings.hourlySalary} · ₪${terms.hourly_rate}` : terms?.mode === "global" ? `${he.settings.monthlySalary} · ₪${terms.monthly_salary}` : he.settings.salaryHidden}</b></div>
        <details open={params.result?.startsWith("compensation_")} className="rounded-2xl border border-[var(--border-soft)] p-4"><summary className="flex min-h-11 cursor-pointer items-center font-bold text-[var(--primary)]">{he.settings.addCompensation}</summary><form action={saveCompensation} className="mt-4 grid gap-3">
          <Field id="compensation-effective-from" label={he.settings.effectiveFrom} name="effectiveFrom" type="date" defaultValue={today} required />
          <label className="field"><span>{he.settings.displayMode}</span><select className="input" name="mode" defaultValue={terms?.mode ?? "hidden"}><option value="hidden">{he.settings.noSalaryDisplay}</option><option value="hourly">{he.settings.hourlySalary}</option><option value="global">{he.settings.monthlySalary}</option></select></label>
          <Field label={he.settings.hourlyRate} name="hourlyRate" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={terms?.hourly_rate ?? ""} />
          <Field label={he.settings.monthlySalaryAmount} name="monthlySalary" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={terms?.monthly_salary ?? ""} />
          <SettingsSubmitButton>{he.settings.saveCompensation}</SettingsSubmitButton>
        </form></details>
      </div>,
    },
    {
      id: "exceptions",
      title: he.settings.exceptions,
      description: he.settings.exceptionsDescription,
      summary: he.settings.exceptionsSummary,
      content: <div key="exceptions" className="grid gap-5">
        <div className="rounded-2xl bg-[var(--primary-soft)] p-4 text-sm text-[var(--primary)]"><b>{he.settings.holidaySyncActive}</b><p>{he.settings.holidaySyncDescription}</p></div>
        <details open={params.result?.startsWith("exception_")} className="rounded-2xl border border-[var(--border-soft)] p-4"><summary className="flex min-h-11 cursor-pointer items-center font-bold text-[var(--primary)]">{he.settings.addException}</summary><form action={addException} className="mt-4 grid gap-3"><Field label={he.settings.date} name="date" type="date" required /><label className="field"><span>{he.settings.dayType}</span><select className="input" name="type"><option value="holiday">{he.settings.holiday}</option><option value="shortened">{he.settings.shortened}</option><option value="day_off">{he.settings.dayOff}</option><option value="special_workday">{he.settings.specialWorkday}</option></select></label><Field id="exception-name" label={he.settings.dayName} name="name" required /><Field label={he.settings.targetMinutes} name="targetMinutes" type="number" inputMode="numeric" min="0" max="1440" /><Field id="exception-note" label={he.entries.note} name="note" /><SettingsSubmitButton>{he.settings.saveException}</SettingsSubmitButton></form></details>
        {exceptions?.length ? <div className="grid gap-2"><h3 className="font-bold">{he.settings.personalExceptions}</h3>{exceptions.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--background)] p-3 text-sm"><p><b>{row.name}</b> · <span dir="ltr">{row.exception_date}</span>{row.target_minutes != null ? ` · ${row.target_minutes} ${he.onboarding.minutesUnit}` : ""}</p><form action={deleteException}><input type="hidden" name="id" value={row.id} /><SettingsSubmitButton className="grid size-11 place-items-center rounded-full text-[var(--error)]"><Trash2 aria-hidden size={17} /><span className="sr-only">{he.settings.deleteException}</span></SettingsSubmitButton></form></div>)}</div> : null}
      </div>,
    },
    {
      id: "profile",
      title: he.settings.profile,
      description: he.settings.profileDescription,
      summary: he.settings.profileSummary,
      content: <form key="profile" action={saveProfile} className="grid gap-3"><Field label={he.auth.username} name="username" autoComplete="username" defaultValue={profile?.username} required /><Field label={he.settings.fullName} name="fullName" autoComplete="name" defaultValue={profile?.full_name ?? ""} /><div className="rounded-2xl bg-[var(--background)] p-4 text-sm"><span className="muted">{he.settings.timezone}</span><b className="block">{he.settings.israelTimezone}</b></div><div className="muted text-sm">{he.auth.email}: <b dir="ltr">{user.email}</b></div><SettingsSubmitButton>{he.settings.saveChanges}</SettingsSubmitButton></form>,
    },
    {
      id: "accessibility",
      title: he.settings.accessibility,
      description: he.settings.accessibilityDescription,
      summary: he.settings.accessibilitySummary,
      content: <AccessibilitySettings key="accessibility" />,
    },
  ];

  return <div className="grid gap-6">
    <header><p className="muted text-sm">{he.settings.pageSubtitle}</p><h1 className="text-3xl font-extrabold">{he.settings.title}</h1></header>
    {notice && <div role={notice.ok ? "status" : "alert"} className={"rounded-2xl p-4 font-bold " + (notice.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--error-soft)] text-[var(--error)]")}>{notice.text}</div>}
    <SettingsHub key={`${initialSection}-${params.result ?? ""}`} sections={sections} initialSection={initialSection} />
    <form action={logoutAction}><SettingsSubmitButton className="button-danger"><LogOut aria-hidden />{he.auth.logout}</SettingsSubmitButton></form>
  </div>;
}
function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { const { label, id: providedId, ...rest } = props; const id = providedId ?? "settings-" + rest.name; return <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" {...rest} /></div>; }
function Toggle({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="flex min-h-14 items-center justify-between rounded-2xl bg-[var(--background)] p-4"><b>{label}</b><input type="checkbox" className="size-5 accent-[var(--primary)]" {...props} /></label>; }