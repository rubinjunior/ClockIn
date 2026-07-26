import { addDays, format, startOfDay, subDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { Bell, CalendarDays, ChevronLeft, Gauge, HeartPulse, Palmtree, Settings, Tag } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { LiveClockCard } from "@/components/clock/live-clock-card";
import { EntryEditorProvider, EntryEditorTrigger } from "@/components/entries/entry-editor";
import type { EditableEntry, EntryFormCategory } from "@/components/entries/entry-form";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { formatLocalDate, formatMinutes, formatTime } from "@/lib/formatting";
import { he } from "@/lib/i18n/he";
import { createClient } from "@/lib/supabase/server";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { requireUser } from "@/lib/supabase/session";
import { getCurrentProfile } from "@/lib/supabase/profile";
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
  let recent: Array<{ id: string; clock_in: string; clock_out: string | null; category_id: string | null; note: string | null }> = [];
  let categories: EntryFormCategory[] = [];
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
    recent = demoEntries().map((entry) => ({ id: entry.id, clock_in: entry.clockIn, clock_out: entry.clockOut, category_id: entry.categoryId ?? null, note: entry.note ?? null }));
    weeklyWorked = recent.reduce((total, entry) => total + (entry.clock_out ? Math.round((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000) : 0), 0);
  } else {
    profile = await getCurrentProfile();
    const supabase = await createClient();
    const timezone = profile?.timezone ?? "Asia/Jerusalem";
    const localNow = toZonedTime(new Date(), timezone);
    const today = format(localNow, "yyyy-MM-dd");
    const weekStart = format(subDays(localNow, localNow.getDay()), "yyyy-MM-dd");
    const calendarRulesPromise = Promise.all([...new Set([weekStart.slice(0, 4), today.slice(0, 4)])].map((year) => getIsraelCalendarRules(Number(year))));

    const [activeResult, recentResult, weekResult, balancesResult, remindersResult, leavesResult, schedulesResult, exceptionsResult, categoriesResult] = await Promise.all([
      supabase.from("time_entries").select("clock_in").is("clock_out", null).is("deleted_at", null).maybeSingle(),
      supabase.from("time_entries").select("id,clock_in,clock_out,category_id,note").not("clock_out", "is", null).is("deleted_at", null).order("clock_in", { ascending: false }).limit(4),
      supabase.rpc("monthly_report", { month_start: weekStart, month_end: today, include_future: false }),
      supabase.from("leave_balance_adjustments").select("leave_type,minutes").lte("effective_date", today),
      supabase.from("reminder_settings").select("reminder_type,local_time,timezone,weekdays").eq("enabled", true),
      supabase.from("leave_entries").select("leave_type,start_date,end_date,partial_minutes").eq("status", "approved").lte("start_date", today),
      supabase.from("work_schedule_versions").select("effective_from,effective_to,work_schedule_days(weekday,is_workday,target_minutes)").order("effective_from"),
      supabase.from("calendar_exceptions").select("exception_date,exception_type,target_minutes").lte("exception_date", today),
      supabase.from("work_categories").select("id,name,is_active").order("sort_order").order("created_at"),
    ]);
    requireSuccessfulQueries("dashboard", [activeResult, recentResult, weekResult, balancesResult, remindersResult, leavesResult, schedulesResult, exceptionsResult, categoriesResult]);

    active = activeResult.data;
    recent = recentResult.data ?? [];
    categories = (categoriesResult.data ?? []).map((category) => ({ id: category.id, name: category.name, isActive: category.is_active }));

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

  const timezone = profile?.timezone ?? "Asia/Jerusalem";
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const weeklyBalance = weeklyWorked - weeklyExpected;
  const weeklyProgress = weeklyExpected > 0 ? Math.min(100, Math.round((weeklyWorked / weeklyExpected) * 100)) : 0;

  return (
    <EntryEditorProvider categories={categories} timezone={timezone}>
      <div className="grid gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="muted text-sm">{formatLocalDate(new Date())}</p><h1 className="mt-1 text-3xl font-extrabold">{he.clock.greeting}, {username}</h1><p className="muted mt-1 text-sm">{he.dashboard.pageSubtitle}</p></div>
          <div className="flex items-center gap-2">
            <EntryEditorTrigger ariaLabel={he.entries.add} showLabel />
            <Link href="/app/settings" aria-label={he.dashboard.openSettings} className="grid size-12 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-sm"><Settings aria-hidden size={22}/></Link>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_.7fr]">
          <LiveClockCard activeClockIn={active?.clock_in} workedMinutes={todayWorked} expectedMinutes={todayExpected}/>
          <aside className="grid gap-3" aria-label={he.dashboard.weeklySnapshot}>
            <WeekProgressCard worked={weeklyWorked} expected={weeklyExpected} balance={weeklyBalance} progress={weeklyProgress} />
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard icon={Palmtree} label={he.dashboard.vacation} value={formatMinutes(vacationMinutes)} tone="success"/>
              <SummaryCard icon={HeartPulse} label={he.dashboard.sick} value={formatMinutes(sickMinutes)}/>
              <div className="col-span-2 [&>article]:h-full"><SummaryCard icon={Bell} label={he.dashboard.reminder} value={nextReminder?.local_time.slice(0, 5) ?? "—"} detail={nextReminder ? reminderLabel : he.dashboard.noReminder} tone="warning"/></div>
            </div>
          </aside>
        </div>

        <section className="card p-5" aria-labelledby="recent-entries-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="recent-entries-title" className="text-xl font-extrabold">{he.dashboard.recent}</h2><p className="muted text-sm">{he.dashboard.recentDescription}</p></div>
            <Link href="/app/entries" className="button-secondary !min-h-11 !px-4">{he.dashboard.allEntries}<ChevronLeft aria-hidden size={18}/></Link>
          </div>
          {recent.length ? <div className="divide-y divide-[var(--border-soft)] rounded-2xl bg-[var(--background)]">{recent.map((entry) => {
            const minutes = entry.clock_out ? Math.max(0, Math.round((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60_000)) : 0;
            const editable: EditableEntry | undefined = entry.clock_out ? {
              id: entry.id,
              clockInLocal: formatInTimeZone(entry.clock_in, timezone, "yyyy-MM-dd'T'HH:mm"),
              clockOutLocal: formatInTimeZone(entry.clock_out, timezone, "yyyy-MM-dd'T'HH:mm"),
              categoryId: entry.category_id,
              note: entry.note,
            } : undefined;
            return <article key={entry.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 sm:p-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-[var(--primary)]"><CalendarDays aria-hidden size={20}/></span>
              <div className="min-w-0"><p className="font-bold">{formatLocalDate(entry.clock_in, { dateStyle: "medium" })}</p><p className="muted metric-value text-sm">{formatTime(entry.clock_in)}–{entry.clock_out ? formatTime(entry.clock_out) : he.entries.open}</p>{entry.category_id && <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-[var(--primary)]"><Tag aria-hidden size={13}/>{categoryNames.get(entry.category_id) ?? he.categories.archived}</p>}</div>
              <div className="flex items-center gap-2"><b className="metric-value hidden sm:block">{entry.clock_out ? formatMinutes(minutes) : he.entries.active}</b>{editable && <EntryEditorTrigger entry={editable} ariaLabel={`${he.entries.edit} ${formatTime(entry.clock_in)}`} />}</div>
            </article>;
          })}</div> : <div className="rounded-2xl bg-[var(--background)] p-7 text-center"><CalendarDays className="mx-auto text-[var(--primary)]" aria-hidden/><p className="mt-3 font-bold">{he.dashboard.noEntriesYet}</p><p className="muted text-sm">{he.dashboard.noEntriesDescription}</p></div>}
        </section>
      </div>
    </EntryEditorProvider>
  );
}

function WeekProgressCard({ worked, expected, balance, progress }: { worked: number; expected: number; balance: number; progress: number }) {
  const balanceText = expected === 0 ? he.dashboard.noWeeklyTarget : balance >= 0 ? `${formatMinutes(balance)} ${he.dashboard.aboveTarget}` : `${he.dashboard.missingToTarget} ${formatMinutes(Math.abs(balance))}`;
  return <section className="card p-5" aria-labelledby="week-progress-title">
    <div className="flex items-start justify-between gap-3"><div><h2 id="week-progress-title" className="muted text-sm font-bold">{he.dashboard.weeklyProgress}</h2><p className="metric-value mt-1 text-2xl font-extrabold">{formatMinutes(worked)} <span className="muted text-base">/ {formatMinutes(expected)}</span></p></div><span className="grid size-11 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Gauge aria-hidden size={22}/></span></div>
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--background)]" role="progressbar" aria-label={he.dashboard.weeklyProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span className="block h-full rounded-full bg-[var(--primary)] transition-[width] duration-300" style={{ width: `${progress}%` }}/></div>
    <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="muted">{progress}% {he.dashboard.completed}</span><b className={balance < 0 ? "text-[var(--error)]" : "text-[var(--success)]"}>{balanceText}</b></div>
  </section>;
}