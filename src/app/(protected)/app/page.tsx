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
import { requireUser } from "@/lib/supabase/session";
import { demoEntries, isDemoMode } from "@/lib/demo";

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
    profile = profileResult.data;
    const timezone = profile?.timezone ?? "Asia/Jerusalem";
    const localNow = toZonedTime(new Date(), timezone);
    const today = format(localNow, "yyyy-MM-dd");
    const weekStart = format(subDays(localNow, localNow.getDay()), "yyyy-MM-dd");

    const [activeResult, recentResult, weekResult, balancesResult, remindersResult] = await Promise.all([
      supabase.from("time_entries").select("clock_in").is("clock_out", null).is("deleted_at", null).maybeSingle(),
      supabase.from("time_entries").select("id,clock_in,clock_out").not("clock_out", "is", null).is("deleted_at", null).order("clock_in", { ascending: false }).limit(3),
      supabase.rpc("monthly_report", { month_start: weekStart, month_end: today, include_future: false }),
      supabase.from("leave_balance_adjustments").select("leave_type,minutes").lte("effective_date", today),
      supabase.from("reminder_settings").select("reminder_type,local_time,timezone,weekdays").eq("enabled", true),
    ]);

    active = activeResult.data;
    recent = recentResult.data ?? [];

    for (const row of weekResult.data ?? []) {
      const worked = Number(row.worked_minutes);
      const expected = Number(row.expected_minutes);
      weeklyWorked += worked;
      weeklyExpected += expected;
      if (row.work_date === today) {
        todayWorked = worked;
        todayExpected = expected;
      }
    }

    for (const adjustment of balancesResult.data ?? []) {
      if (adjustment.leave_type === "vacation") vacationMinutes += Number(adjustment.minutes);
      if (adjustment.leave_type === "sick") sickMinutes += Number(adjustment.minutes);
    }

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