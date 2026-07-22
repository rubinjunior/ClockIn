import Link from "next/link";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, CircleMinus, Clock, Gauge, LayoutList, Plane, Plus, Stethoscope, Tag } from "lucide-react";
import { ReportActions } from "@/components/reports/report-actions";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { EntryForm, type EditableEntry, type EntryFormCategory } from "@/components/entries/entry-form";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/session";
import { calculateMonthlyBalance } from "@/lib/time/calculations";
import { summarizeCategorizedSessions } from "@/lib/reports/category-summary";
import { formatMinutes, formatTime } from "@/lib/formatting";
import { demoReportRows, isDemoMode } from "@/lib/demo";
import { he } from "@/lib/i18n/he";

type ReportDay = {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  creditedAbsenceMinutes: number;
  manualAdjustmentMinutes: number;
  finalBalanceMinutes: number;
  missingMinutes: number;
  overtimeMinutes: number;
  sessions: number;
  future: boolean;
};

type ReportEntry = {
  id: string;
  clock_in: string;
  clock_out: string;
  category_id: string | null;
  note: string | null;
};

function shiftMonth(month: string, offset: number) {
  const date = new Date(month + "-01T00:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function countLeaveDays(entries: Array<{ leave_type: string; start_date: string; end_date: string; partial_minutes: number | null }>, type: string, start: string, end: string) {
  return entries.filter((entry) => entry.leave_type === type).reduce((total, entry) => {
    if (entry.partial_minutes) return total + 0.5;
    const firstDate = entry.start_date < start ? start : entry.start_date;
    const lastDate = entry.end_date > end ? end : entry.end_date;
    const first = new Date(firstDate + "T12:00:00Z");
    const last = new Date(lastDate + "T12:00:00Z");
    return total + Math.max(0, Math.round((last.getTime() - first.getTime()) / 86400000) + 1);
  }, 0);
}

function reportHref(month: string, full: boolean, view: "list" | "calendar") {
  return "?month=" + month + "&mode=" + (full ? "full" : "to-date") + "&view=" + view;
}

function editableEntry(entry: ReportEntry, timezone: string): EditableEntry {
  return {
    id: entry.id,
    clockInLocal: formatInTimeZone(entry.clock_in, timezone, "yyyy-MM-dd'T'HH:mm"),
    clockOutLocal: formatInTimeZone(entry.clock_out, timezone, "yyyy-MM-dd'T'HH:mm"),
    categoryId: entry.category_id,
    note: entry.note,
  };
}

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string; mode?: string; view?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const current = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : current;
  const full = params.mode === "full";
  const view = params.view === "calendar" ? "calendar" : "list";
  const start = month + "-01";
  const last = new Date(month + "-01T00:00:00Z");
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const end = last.toISOString().slice(0, 10);
  const endExclusiveDate = new Date(end + "T12:00:00Z");
  endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);
  const today = new Date().toISOString().slice(0, 10);
  const demoMode = isDemoMode();

  let timezone = "Asia/Jerusalem";
  let days: ReportDay[];
  let leaveEntries: Array<{ leave_type: string; start_date: string; end_date: string; partial_minutes: number | null }> = [];
  let categories: EntryFormCategory[] = [];
  let reportEntries: ReportEntry[] = [];

  if (demoMode) {
    days = demoReportRows(month);
  } else {
    const supabase = await createClient();
    const profile = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
    timezone = profile.data?.timezone ?? timezone;
    const startsAt = fromZonedTime(start + "T00:00:00", timezone).toISOString();
    const endsAt = fromZonedTime(endExclusiveDate.toISOString().slice(0, 10) + "T00:00:00", timezone).toISOString();

    const [reportResult, leaveResult, categoriesResult, entriesResult] = await Promise.all([
      supabase.rpc("monthly_report", { month_start: start, month_end: end, include_future: full }),
      supabase.from("leave_entries").select("leave_type,start_date,end_date,partial_minutes").eq("status", "approved").lte("start_date", end).gte("end_date", start),
      supabase.from("work_categories").select("id,name,is_active").order("sort_order").order("created_at"),
      supabase.from("time_entries").select("id,clock_in,clock_out,category_id,note").lt("clock_in", endsAt).gt("clock_out", startsAt).is("deleted_at", null).not("clock_out", "is", null).order("clock_in"),
    ]);

    days = (reportResult.data ?? []).map((row: {
      work_date: string;
      expected_minutes: number;
      worked_minutes: number;
      credited_absence_minutes: number;
      manual_adjustment_minutes: number;
      final_balance_minutes: number;
      missing_minutes: number;
      overtime_minutes: number;
      sessions: number;
    }) => ({
      date: row.work_date,
      expectedMinutes: Number(row.expected_minutes),
      workedMinutes: Number(row.worked_minutes),
      creditedAbsenceMinutes: Number(row.credited_absence_minutes),
      manualAdjustmentMinutes: Number(row.manual_adjustment_minutes),
      finalBalanceMinutes: Number(row.final_balance_minutes),
      missingMinutes: Number(row.missing_minutes),
      overtimeMinutes: Number(row.overtime_minutes),
      sessions: Number(row.sessions),
      future: row.work_date > today,
    }));
    leaveEntries = leaveResult.data ?? [];
    categories = (categoriesResult.data ?? []).map((category) => ({ id: category.id, name: category.name, isActive: category.is_active }));
    reportEntries = (entriesResult.data ?? []).filter((entry): entry is ReportEntry => Boolean(entry.clock_out));
  }

  const vacationDays = countLeaveDays(leaveEntries, "vacation", start, end);
  const sickDays = countLeaveDays(leaveEntries, "sick", start, end);
  const dayNumber = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
  const totals = calculateMonthlyBalance(days);
  const monthLabel = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(new Date(month + "-01T12:00:00Z"));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const categorySummary = summarizeCategorizedSessions(reportEntries.map((entry) => ({ clockIn: entry.clock_in, clockOut: entry.clock_out, categoryId: entry.category_id })), timezone, start, end);
  const entriesByDate: Record<string, ReportEntry[]> = {};
  for (const entry of reportEntries) {
    const date = formatInTimeZone(entry.clock_in, timezone, "yyyy-MM-dd");
    (entriesByDate[date] ??= []).push(entry);
  }
  const visibleCategories = categories.filter((category) => category.isActive || (categorySummary.totals[category.id] ?? 0) > 0);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="muted text-sm">תמונה מלאה של החודש</p><h1 className="text-3xl font-extrabold">{he.report.title}</h1></div>
        <ReportActions month={month} />
      </header>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-3">
        <Link aria-label="החודש הבא" className="grid size-12 place-items-center rounded-full bg-[var(--background)]" href={reportHref(shiftMonth(month, 1), full, view)}><ChevronRight aria-hidden /></Link>
        <div className="text-center"><h2 className="text-xl font-extrabold">{monthLabel}</h2><Link className="text-sm font-bold text-[var(--primary)]" href={reportHref(current, false, view)}>{he.report.currentMonth}</Link></div>
        <Link aria-label="החודש הקודם" className="grid size-12 place-items-center rounded-full bg-[var(--background)]" href={reportHref(shiftMonth(month, -1), full, view)}><ChevronLeft aria-hidden /></Link>
      </section>

      <div className="no-print mx-auto flex rounded-full bg-[var(--surface-muted)] p-1" role="group" aria-label="טווח הדוח">
        <Link href={reportHref(month, false, view)} className={"min-h-11 rounded-full px-5 py-2.5 font-bold " + (!full ? "bg-white text-[var(--primary)] shadow-sm" : "muted")}>{he.report.toDate}</Link>
        <Link href={reportHref(month, true, view)} className={"min-h-11 rounded-full px-5 py-2.5 font-bold " + (full ? "bg-white text-[var(--primary)] shadow-sm" : "muted")}>{he.report.fullMonth}</Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={Clock} label={he.report.worked} value={formatMinutes(totals.workedMinutes)} />
        <SummaryCard icon={Gauge} label={he.report.expected} value={formatMinutes(totals.expectedMinutes)} />
        <SummaryCard icon={CircleMinus} label={he.report.missing} value={formatMinutes(totals.missingMinutes)} tone="warning" />
        <SummaryCard icon={CircleCheck} label={he.report.overtime} value={formatMinutes(totals.overtimeMinutes)} tone="success" />
        <SummaryCard icon={Plane} label={he.report.vacationDays} value={dayNumber.format(vacationDays)} />
        <SummaryCard icon={Stethoscope} label={he.report.sickDays} value={dayNumber.format(sickDays)} />
        {visibleCategories.map((category) => <SummaryCard key={category.id} icon={Tag} label={category.name} value={formatMinutes(categorySummary.totals[category.id] ?? 0)} />)}
        <Link href="/app/settings?newCategory=1#work-categories" aria-label={he.report.addCategoryCard} className="grid min-h-[132px] place-items-center rounded-3xl border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-500">
          <Plus aria-hidden size={34} />
        </Link>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">{he.report.daily}</h2>
          <div className="no-print flex rounded-full bg-[var(--surface-muted)] p-1" role="group" aria-label={he.report.chooseView}>
            <Link href={reportHref(month, full, "list")} className={"flex min-h-11 items-center gap-2 rounded-full px-4 py-2 font-bold " + (view === "list" ? "bg-white text-[var(--primary)] shadow-sm" : "muted")}><LayoutList aria-hidden size={18} />{he.report.listView}</Link>
            <Link href={reportHref(month, full, "calendar")} className={"flex min-h-11 items-center gap-2 rounded-full px-4 py-2 font-bold " + (view === "calendar" ? "bg-white text-[var(--primary)] shadow-sm" : "muted")}><CalendarDays aria-hidden size={18} />{he.report.calendarView}</Link>
          </div>
        </div>

        {view === "calendar" ? (
          <CalendarView days={days} month={month} entriesByDate={entriesByDate} categoryByDate={categorySummary.byDate} categoryNames={categoryNames} categories={categories} timezone={timezone} />
        ) : (
          <ListView days={days} entriesByDate={entriesByDate} categoryByDate={categorySummary.byDate} categoryNames={categoryNames} categories={categories} timezone={timezone} />
        )}
      </section>
    </div>
  );
}

function ListView({ days, entriesByDate, categoryByDate, categoryNames, categories, timezone }: {
  days: ReportDay[];
  entriesByDate: Record<string, ReportEntry[]>;
  categoryByDate: Record<string, Record<string, number>>;
  categoryNames: Map<string, string>;
  categories: EntryFormCategory[];
  timezone: string;
}) {
  if (!days.length) return <div className="card p-8 text-center"><p className="font-bold">{he.report.empty}</p></div>;
  const headers = [he.report.date, he.report.status, he.report.expected, he.report.worked, he.report.adjustments, he.report.balance, he.report.entriesCount, he.report.edit];
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {days.map((day) => <DayCard key={day.date} day={day} entries={entriesByDate[day.date] ?? []} categoryMinutes={categoryByDate[day.date] ?? {}} categoryNames={categoryNames} categories={categories} timezone={timezone} />)}
      </div>
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-[var(--primary-soft)] text-[var(--primary)]">
            <tr>{headers.map((header, index) => <th className={"p-3 align-middle " + (index < 2 ? "text-start" : "text-center")} key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr data-date={day.date} key={day.date} className="border-t border-[var(--border-soft)]">
                <td className="p-3 text-start align-middle font-bold">{new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "numeric" }).format(new Date(day.date + "T12:00:00Z"))}</td>
                <td className="p-3 text-start align-middle">{dayStatus(day)}</td>
                <td className="p-3 text-center align-middle"><MinuteValue minutes={day.expectedMinutes} /></td>
                <td className="p-3 text-center align-middle"><MinuteValue minutes={day.workedMinutes} /></td>
                <td className="p-3 text-center align-middle"><MinuteValue minutes={day.manualAdjustmentMinutes} /></td>
                <td className="p-3 text-center align-middle font-bold"><MinuteValue minutes={day.finalBalanceMinutes} /></td>
                <td className="p-3 text-center align-middle">{day.sessions}</td>
                <td className="p-2 text-center align-middle"><DayEntryActions date={day.date} entries={entriesByDate[day.date] ?? []} categories={categories} timezone={timezone} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CalendarView({ days, month, entriesByDate, categoryByDate, categoryNames, categories, timezone }: {
  days: ReportDay[];
  month: string;
  entriesByDate: Record<string, ReportEntry[]>;
  categoryByDate: Record<string, Record<string, number>>;
  categoryNames: Map<string, string>;
  categories: EntryFormCategory[];
  timezone: string;
}) {
  const offset = new Date(month + "-01T12:00:00Z").getUTCDay();
  return (
    <div className="card overflow-hidden p-2 sm:p-4">
      <div className="grid grid-cols-7" aria-hidden>{he.weekdaysShort.map((day) => <div key={day} className="p-2 text-center text-xs font-bold text-[var(--text-secondary)] sm:text-sm">{day}</div>)}</div>
      <div className="grid grid-cols-7 border-e border-t border-[var(--border-soft)]">
        {Array.from({ length: offset }, (_, index) => <div key={"blank-" + index} className="min-h-20 border-b border-s border-[var(--border-soft)] bg-[var(--background)]/50" aria-hidden />)}
        {days.map((day) => {
          const entries = entriesByDate[day.date] ?? [];
          const categoryMinutes = categoryByDate[day.date] ?? {};
          return (
            <article key={day.date} className={"min-h-24 overflow-hidden border-b border-s border-[var(--border-soft)] p-1.5 sm:min-h-32 sm:p-2 " + (day.future ? "bg-[var(--background)] text-[var(--text-secondary)]" : "bg-white")}>
              <div className="flex items-start justify-between gap-1">
                <time className="font-bold" dateTime={day.date}>{Number(day.date.slice(-2))}</time>
                {entries[0] && <EntryForm compact ariaLabel={he.report.editEntry + " " + day.date} categories={categories} timezone={timezone} entry={editableEntry(entries[0], timezone)} />}
              </div>
              <p className="mt-2 text-center text-xs font-bold sm:text-sm"><MinuteValue minutes={day.workedMinutes} /></p>
              <div className="mt-1 hidden gap-1 sm:grid">
                {Object.entries(categoryMinutes).slice(0, 2).map(([categoryId, minutes]) => <span key={categoryId} className="truncate rounded-md bg-[var(--primary-soft)] px-1 py-0.5 text-[10px] text-[var(--primary)]" title={categoryNames.get(categoryId)}>{categoryNames.get(categoryId)} · {formatMinutes(minutes)}</span>)}
              </div>
              {entries.length > 1 && <p className="muted mt-1 text-center text-[10px]">+{entries.length - 1}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DayCard({ day, entries, categoryMinutes, categoryNames, categories, timezone }: {
  day: ReportDay;
  entries: ReportEntry[];
  categoryMinutes: Record<string, number>;
  categoryNames: Map<string, string>;
  categories: EntryFormCategory[];
  timezone: string;
}) {
  return (
    <article id={"day-" + day.date} className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-extrabold">{new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(day.date + "T12:00:00Z"))}</h3><p className="muted text-sm">{day.sessions ? day.sessions + " " + he.report.entriesCount : he.report.noEntries}</p></div>
        <span className={"rounded-full px-3 py-1 text-xs font-bold " + (day.finalBalanceMinutes < 0 ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--success-soft)] text-[var(--success)]")}>{dayStatus(day)}</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div><dt className="muted text-xs">{he.report.expected}</dt><dd className="font-bold"><MinuteValue minutes={day.expectedMinutes} /></dd></div>
        <div><dt className="muted text-xs">{he.report.worked}</dt><dd className="font-bold"><MinuteValue minutes={day.workedMinutes} /></dd></div>
        <div><dt className="muted text-xs">{he.report.balance}</dt><dd className="font-bold"><MinuteValue minutes={day.finalBalanceMinutes} /></dd></div>
      </dl>
      {Object.keys(categoryMinutes).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{Object.entries(categoryMinutes).map(([categoryId, minutes]) => <span key={categoryId} className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold text-[var(--primary)]">{categoryNames.get(categoryId)} · {formatMinutes(minutes)}</span>)}</div>}
      <div className="mt-3 border-t border-[var(--border-soft)] pt-3"><DayEntryActions date={day.date} entries={entries} categories={categories} timezone={timezone} /></div>
    </article>
  );
}

function DayEntryActions({ date, entries, categories, timezone }: { date: string; entries: ReportEntry[]; categories: EntryFormCategory[]; timezone: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {entries.map((entry) => <EntryForm key={entry.id} compact ariaLabel={he.report.editEntry + " " + formatTime(entry.clock_in)} categories={categories} timezone={timezone} entry={editableEntry(entry, timezone)} />)}
      <EntryForm compact ariaLabel={he.entries.add + " " + date} categories={categories} timezone={timezone} initialDate={date} />
    </div>
  );
}

function MinuteValue({ minutes }: { minutes: number }) {
  return <span className="metric-value inline-flex min-w-[6.5ch] justify-center text-center" dir="ltr">{formatMinutes(minutes)}</span>;
}
function dayStatus(day: ReportDay) {
  if (day.future) return he.report.future;
  if (day.finalBalanceMinutes < 0) return he.status.missing;
  return he.report.completed;
}