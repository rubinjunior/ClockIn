import { addDays, format, startOfDay, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Bell, CalendarDays, ChevronLeft, HeartPulse, Palmtree, Settings, Timer } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { LiveClockCard } from "@/components/clock/live-clock-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { formatLocalDate, formatMinutes, formatTime } from "@/lib/formatting";
import { he } from "@/lib/i18n/he";
import { createClient } from "@/lib/supabase/server";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { requireUser } from "@/lib/supabase/session";
import { demoEntries, isDemoMode } from "@/lib/demo";
import { getIsraelCalendarRules } from "@/lib/holidays/israel";
import { applyIsraelCalendar } from "@/lib/reports/israel-calendar";
import { calculateLeaveBalances, type ExceptionForBalance, type LeaveEntryForBalance, type ScheduleForBalance } from "@/lib/leave/balances";

type DashboardReportRow = {
  work_date: string; expected_minutes: number; worked_minutes: number; credited_absence_minutes: number;
  manual_adjustment_minutes: number; final_balance_minutes: number; missing_minutes: number; overtime_minutes: number;
  sessions: number; holiday_label: string | null; shortened_day: boolean;
};
type ReminderSetting = {
  reminder_type: "clock_in" | "clock_out";
  local_time: string;
  timezone: string;
  weekdays: number[];
};

function findNextReminder(settings: ReminderSetting[], now: Date, timezone: string) {
  const localNow = toZonedTime(now, timezone);
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = addDays(startOfDay(localNow), offset);
    const candidates = settings
      .filter((setting) => setting.weekdays.includes(day.getDay()))
      .map((setting) => {
        const [hours, minutes] = setting.local_time.split(":").map(Number);
        const due = new Date(day);
        due.setHours(hours, minutes, 0, 0);
        return { setting, due };
      })
      .filter(({ due }) => due > localNow)
      .sort((a, b) => a.due.getTime() - b.due.getTime());
    if (candidates[0]) return candidates[0].setting;
  }
  return null;
}

export default async function DashboardPage() {
  const user = await requireUser();
  let profile: { username: string; timezone: string } | null = null;
  let active: { clock_in: string } | null = null;
  let recent: Array<{ id: string; clock_in: string; clock_out: string | null }> = [];
  let weeklyWorked = 0;
  let weeklyExpected = 0;
  let todayWorked = 0;
  let todayExpected = 0;
  let vacationMinutes = 0;
  let sickMinutes = 0;
  let nextReminder: ReminderSetting | null = null;

  if (isDemoMode()) {
    profile = { username: user.user_metadata.username, timezone: "Asia/Jerusalem" };
    const activeValue = (await cookies()).get("clockin_demo_active")?.value;
    active = activeValue ? { clock_in: activeValue } : null;
    recent = demoEntries().map((entry) => ({ id: entry.id, clock_in: entry.clockIn, clock_out: entry.clockOut }));
    weeklyWorked = recent.reduce((total, entry) => total + (entry.clock_out ? Math.round((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000) : 0), 0);
  } else {
    const supabase = await createClient();
    const profileResult = await supabase.from("profiles").select("username,timezone").eq("id", user.id).single();
    requireSuccessfulQueries("dashboard-profile", [profileResult]);
    profile = profileResult.data;
    const timezone = profile?.timezone ?? "Asia/Jerusalem";
    const localNow = toZonedTime(new Date(), timezone);
    const today = format(localNow, "yyyy-MM-dd");
    const weekStart = format(subDays(localNow, localNow.getDay()), "yyyy-MM-dd");
    const calendarRulesPromise = Promise.all([...new Set([weekStart.slice(0, 4), today.slice(0, 4)])].map((year) => getIsraelCalendarRules(Number(year))));

    const [activeResult, recentResult, weekResult, balancesResult, remindersResult, leavesResult, schedulesResult, exceptionsResult] = await Promise.all([
      supabase.from("time_entries").select("clock_in").is("clock_out", null).is("deleted_at", null).maybeSingle(),
      supabase.from("time_entries").select("id,clock_in,clock_out").not("clock_out", "is", null).is("deleted_at", null).order("clock_in", { ascending: false }).limit(3),
      supabase.rpc("monthly_report", { month_start: weekStart, month_end: today, include_future: false }),
      supabase.from("leave_balance_adjustments").select("leave_type,minutes").lte("effective_date", today),
      supabase.from("reminder_settings").select("reminder_type,local_time,timezone,weekdays").eq("enabled", true),
      supabase.from("leave_entries").select("leave_type,start_date,end_date,partial_minutes").eq("status", "approved").lte("start_date", today),
      supabase.from("work_schedule_versions").select("effective_from,effective_to,work_schedule_days(weekday,is_workday,target_minutes)").order("effective_from"),
      supabase.from("calendar_exceptions").select("exception_date,exception_type,target_minutes").lte("exception_date", today),
    ]);
    requireSuccessfulQueries("dashboard", [activeResult, recentResult, weekResult, balancesResult, remindersResult, leavesResult, schedulesResult, exceptionsResult]);

    active = activeResult.data;
    recent = recentResult.data ?? [];

    const weekDays = applyIsraelCalendar((weekResult.data ?? []).map((row: DashboardReportRow) => ({
      date: row.work_date,
      expectedMinutes: Number(row.expected_minutes) || 0,
      workedMinutes: Number(row.worked_minutes) || 0,
      creditedAbsenceMinutes: Number(row.credited_absence_minutes) || 0,
      manualAdjustmentMinutes: Number(row.manual_adjustment_minutes) || 0,
      finalBalanceMinutes: Number(row.final_balance_minutes) || 0,
      missingMinutes: Number(row.missing_minutes) || 0,
      overtimeMinutes: Number(row.overtime_minutes) || 0,
      sessions: Number(row.sessions) || 0,
      future: row.work_date > today,
      holidayLabel: row.holiday_label ?? null,
      shortenedDay: Boolean(row.shortened_day),
    })), (await calendarRulesPromise).flat(), false);

    for (const row of weekDays) {
      weeklyWorked += row.workedMinutes;
      weeklyExpected += row.expectedMinutes;
      if (row.date === today) {
        todayWorked = row.workedMinutes;
        todayExpected = row.expectedMinutes;
      }
    }

    const leaveRows: LeaveEntryForBalance[] = (leavesResult.data ?? []).map((entry) => ({ leaveType: entry.leave_type as "vacation" | "sick", startDate: entry.start_date, endDate: entry.end_date, partialMinutes: entry.partial_minutes }));
    const leaveYearSet = new Set<number>([Number(today.slice(0, 4))]);
    for (const entry of leaveRows) {
      for (let year = Number(entry.startDate.slice(0, 4)); year <= Number(entry.endDate.slice(0, 4)); year += 1) leaveYearSet.add(year);
    }
    const leaveYears = [...leaveYearSet];
    const leaveRules = (await Promise.all(leaveYears.map((year) => getIsraelCalendarRules(year)))).flat();
    const leaveBalances = calculateLeaveBalances({
      asOf: today,
      adjustments: (balancesResult.data ?? []).map((item) => ({ leaveType: item.leave_type as "vacation" | "sick", minutes: Number(item.minutes) })),
      leaves: leaveRows,
      schedules: (schedulesResult.data ?? []).map((schedule) => ({ effectiveFrom: schedule.effective_from, effectiveTo: schedule.effective_to, days: schedule.work_schedule_days.map((day) => ({ weekday: day.weekday, isWorkday: day.is_workday, targetMinutes: day.target_minutes })) })) as ScheduleForBalance[],
      exceptions: (exceptionsResult.data ?? []).map((item) => ({ date: item.exception_date, type: item.exception_type, targetMinutes: item.target_minutes })) as ExceptionForBalance[],
      rules: leaveRules,
    });
    vacationMinutes = leaveBalances.vacation;
    sickMinutes = leaveBalances.sick;

    nextReminder = findNextReminder((remindersResult.data ?? []) as ReminderSetting[], new Date(), timezone);
  }

  const username = profile?.username ?? user.user_metadata.username ?? "חבר";
  const reminderLabel = nextReminder?.reminder_type === "clock_in" ? he.clock.start : he.clock.stop;

  return <div className="grid gap-6">
    <header className="flex items-start justify-between gap-4">
      <div><p className="muted text-sm">{formatLocalDate(new Date())}</p><h1 className="mt-1 text-3xl font-extrabold">שלום, {username}</h1></div>
      <Link href="/app/settings" aria-label="פתיחת הגדרות" className="grid size-12 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-sm"><Settings aria-hidden size={22}/></Link>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_.7fr]">
      <LiveClockCard activeClockIn={active?.clock_in} workedMinutes={todayWorked} expectedMinutes={todayExpected}/>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={Timer} label={he.dashboard.week} value={formatMinutes(weeklyWorked)} detail={he.dashboard.outOf + " " + formatMinutes(weeklyExpected)}/>
        <SummaryCard icon={Palmtree} label={he.dashboard.vacation} value={formatMinutes(vacationMinutes)} tone="success"/>
        <SummaryCard icon={HeartPulse} label={he.dashboard.sick} value={formatMinutes(sickMinutes)}/>
        <SummaryCard icon={Bell} label={he.dashboard.reminder} value={nextReminder?.local_time.slice(0, 5) ?? "—"} detail={nextReminder ? reminderLabel : he.dashboard.noReminder} tone="warning"/>
      </div>
    </div>
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-xl font-extrabold">דיווחים אחרונים</h2><p className="muted text-sm">הימים האחרונים שלך במבט אחד</p></div>
        <Link href="/app/entries" className="button-secondary !min-h-11 !px-4">לכל הדיווחים<ChevronLeft aria-hidden size={18}/></Link>
      </div>
      {recent.length ? <div className="grid gap-2">{recent.map((entry) => <article key={entry.id} className="flex items-center gap-3 rounded-2xl bg-[var(--background)] p-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-white text-[var(--primary)]"><CalendarDays aria-hidden size={20}/></span>
        <div className="min-w-0 flex-1"><p className="font-bold">{formatLocalDate(entry.clock_in, { dateStyle: "medium" })}</p><p className="muted metric-value text-sm">{formatTime(entry.clock_in)}–{entry.clock_out ? formatTime(entry.clock_out) : "פתוח"}</p></div>
        <b className="metric-value">{entry.clock_out ? formatMinutes(Math.round((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000)) : "פעיל"}</b>
      </article>)}</div> : <div className="rounded-2xl bg-[var(--background)] p-7 text-center"><CalendarDays className="mx-auto text-[var(--primary)]" aria-hidden/><p className="mt-3 font-bold">עדיין אין דיווחים</p><p className="muted text-sm">הדיווח הראשון יופיע כאן אחרי סיום יום העבודה</p></div>}
    </section>
  </div>;
}