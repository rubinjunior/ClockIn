import Link from "next/link";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CalendarDays, ChevronLeft, ChevronRight, Coins, LayoutList, Pencil } from "lucide-react";
import { ReportActions } from "@/components/reports/report-actions";
import { ReportDayFocus } from "@/components/reports/report-day-focus";
import { ReportOverview, type CompositionItem } from "@/components/reports/report-overview";
import { EntryForm, type EditableEntry, type EntryFormCategory } from "@/components/entries/entry-form";
import { createClient } from "@/lib/supabase/server";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { summarizeCategorizedSessions } from "@/lib/reports/category-summary";
import { formatCurrency, formatMinutes, formatTime } from "@/lib/formatting";
import { demoReportRows, isDemoMode } from "@/lib/demo";
import { he } from "@/lib/i18n/he";
import { getIsraelCalendarRules } from "@/lib/holidays/israel";
import { applyIsraelCalendar } from "@/lib/reports/israel-calendar";
import { estimateMonthlyCompensation, type CompensationTerm } from "@/lib/reports/compensation";
import { type LeaveEntryForBalance } from "@/lib/leave/balances";
import { israelMonth, israelToday } from "@/lib/time/israel";
import { buildReportAnalytics, type ReportDayStatus } from "@/lib/reports/analytics";

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
  provisional?: boolean;
  holidayLabel: string | null;
  shortenedDay: boolean;
};

type ReportEntry = {
  id: string;
  clock_in: string;
  clock_out: string;
  category_id: string | null;
  note: string | null;
};

type EmploymentTermRow = {
  effective_from: string;
  effective_to: string | null;
  compensation_enabled: boolean;
  mode: "hidden" | "hourly" | "global";
  hourly_rate: number | null;
  monthly_salary: number | null;
};

function shiftMonth(month: string, offset: number) {
  const date = new Date(month + "-01T00:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function reportHref(month: string, full: boolean, view: "list" | "calendar", extra: Record<string, string> = {}) {
  return "?" + new URLSearchParams({ month, mode: full ? "full" : "to-date", view, ...extra }).toString();
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

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string; mode?: string; view?: string; editDate?: string; category?: string; status?: string; week?: string }> }) {
  const params = await searchParams;
  const current = israelMonth();
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : current;
  const full = params.mode === "full";
  const view = params.view === "calendar" ? "calendar" : "list";
  const focusDate = /^\d{4}-\d{2}-\d{2}$/.test(params.editDate ?? "") ? params.editDate : undefined;
  const categoryFilter = params.category?.slice(0, 80);
  const statusValue = params.status?.slice(0, 40);
  const statusFilter = (["future", "inProgress", "holiday", "shortened", "vacation", "sick", "incomplete", "missingReport", "missingHours", "overtime", "nonWorkday", "completed", "friday"] as const).find((value) => value === statusValue);
  const weekFilter = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "") ? params.week : undefined;
  const start = month + "-01";
  const last = new Date(month + "-01T00:00:00Z");
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const end = last.toISOString().slice(0, 10);
  const endExclusiveDate = new Date(end + "T12:00:00Z");
  endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);
  const today = israelToday();
  const demoMode = isDemoMode();
  const calendarRulesPromise = getIsraelCalendarRules(Number(month.slice(0, 4)));

  let timezone = "Asia/Jerusalem";
  let days: ReportDay[];
  let leaveEntries: Array<{ leave_type: string; start_date: string; end_date: string; partial_minutes: number | null }> = [];
  let categories: EntryFormCategory[] = [];
  let reportEntries: ReportEntry[] = [];
  let compensationTerms: CompensationTerm[] = [];
  let incompleteEntryDates: string[] = [];

  if (demoMode) {
    days = demoReportRows(month).map((day) => ({ ...day, holidayLabel: null, shortenedDay: false, provisional: day.date === today }));
    compensationTerms = [{ effectiveFrom: start, effectiveTo: null, enabled: true, mode: "hourly", hourlyRate: 62.5, monthlySalary: null }];
  } else {
    const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
    timezone = profile.timezone;
    const startsAt = fromZonedTime(start + "T00:00:00", timezone).toISOString();
    const endsAt = fromZonedTime(endExclusiveDate.toISOString().slice(0, 10) + "T00:00:00", timezone).toISOString();

    const [reportResult, leaveResult, categoriesResult, entriesResult, compensationResult, incompleteResult] = await Promise.all([
      supabase.rpc("monthly_report", { month_start: start, month_end: end, include_future: true }),
      supabase.from("leave_entries").select("leave_type,start_date,end_date,partial_minutes").eq("status", "approved").lte("start_date", end).gte("end_date", start),
      supabase.from("work_categories").select("id,name,is_active").order("sort_order").order("created_at"),
      supabase.from("time_entries").select("id,clock_in,clock_out,category_id,note").lt("clock_in", endsAt).gt("clock_out", startsAt).is("deleted_at", null).not("clock_out", "is", null).order("clock_in"),
      supabase.from("employment_terms").select("effective_from,effective_to,compensation_enabled,mode,hourly_rate,monthly_salary").lte("effective_from", end).or(`effective_to.is.null,effective_to.gte.${start}`).order("effective_from"),
      supabase.from("time_entries").select("clock_in").gte("clock_in", startsAt).lt("clock_in", endsAt).is("clock_out", null).is("deleted_at", null),
    ]);
    requireSuccessfulQueries("report", [reportResult, leaveResult, categoriesResult, entriesResult, compensationResult, incompleteResult]);

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
      holiday_label: string | null;
      shortened_day: boolean;
      provisional?: boolean;
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
      holidayLabel: row.holiday_label ?? null,
      shortenedDay: Boolean(row.shortened_day),
      provisional: Boolean(row.provisional),
    }));
    leaveEntries = leaveResult.data ?? [];
    categories = (categoriesResult.data ?? []).map((category) => ({ id: category.id, name: category.name, isActive: category.is_active }));
    reportEntries = (entriesResult.data ?? []).filter((entry): entry is ReportEntry => Boolean(entry.clock_out));
    incompleteEntryDates = [...new Set((incompleteResult.data ?? []).map((entry) => formatInTimeZone(entry.clock_in, timezone, "yyyy-MM-dd")))];
    compensationTerms = ((compensationResult.data ?? []) as EmploymentTermRow[]).map((term) => ({ effectiveFrom: term.effective_from, effectiveTo: term.effective_to, enabled: term.compensation_enabled, mode: term.mode, hourlyRate: term.hourly_rate == null ? null : Number(term.hourly_rate), monthlySalary: term.monthly_salary == null ? null : Number(term.monthly_salary) }));
  }

  days = applyIsraelCalendar(days, await calendarRulesPromise, true);

  const normalizedLeaveEntries: LeaveEntryForBalance[] = leaveEntries.map((entry) => ({ leaveType: entry.leave_type as "vacation" | "sick", startDate: entry.start_date, endDate: entry.end_date, partialMinutes: entry.partial_minutes }));
  const analytics = buildReportAnalytics({
    days,
    today,
    leaves: normalizedLeaveEntries,
    incompleteEntryDates,
    entries: reportEntries.map((entry) => ({ id: entry.id, clockIn: entry.clock_in, clockOut: entry.clock_out })),
  });
  const vacationDays = days
    .filter((day) => analytics.statusByDate[day.date] === "vacation" && day.expectedMinutes > 0)
    .reduce((sum, day) => sum + day.creditedAbsenceMinutes / day.expectedMinutes, 0);
  const sickDays = days
    .filter((day) => analytics.statusByDate[day.date] === "sick" && day.expectedMinutes > 0)
    .reduce((sum, day) => sum + day.creditedAbsenceMinutes / day.expectedMinutes, 0);
  const compensation = estimateMonthlyCompensation(days, compensationTerms, full);
  const compensationDetail = compensation.mode === "hourly" ? he.report.compensationHourlyDetail : compensation.mode === "global" ? (full ? he.report.compensationGlobalFullDetail : he.report.compensationGlobalToDateDetail) : he.report.compensationMixedDetail;
  const monthLabel = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(new Date(month + "-01T12:00:00Z"));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const categorySummary = summarizeCategorizedSessions(reportEntries.map((entry) => ({ clockIn: entry.clock_in, clockOut: entry.clock_out, categoryId: entry.category_id })), timezone, start, end);
  const entriesByDate: Record<string, ReportEntry[]> = {};
  for (const entry of reportEntries) {
    const date = formatInTimeZone(entry.clock_in, timezone, "yyyy-MM-dd");
    (entriesByDate[date] ??= []).push(entry);
  }
  const visibleCategories = categories.filter((category) => category.isActive || (categorySummary.totals[category.id] ?? 0) > 0);
  const fridayDays = days.filter((day) => new Date(day.date + "T12:00:00Z").getUTCDay() === 5 && day.workedMinutes > 0);
  const fridayMinutes = fridayDays.reduce((sum, day) => sum + day.workedMinutes, 0);
  const vacationMinutes = days.filter((day) => analytics.statusByDate[day.date] === "vacation").reduce((sum, day) => sum + day.creditedAbsenceMinutes, 0);
  const sickMinutes = days.filter((day) => analytics.statusByDate[day.date] === "sick").reduce((sum, day) => sum + day.creditedAbsenceMinutes, 0);
  const composition: CompositionItem[] = visibleCategories
    .filter((category) => (categorySummary.totals[category.id] ?? 0) > 0)
    .map((category) => ({ key: category.id, label: category.name, minutes: categorySummary.totals[category.id] ?? 0, days: categorySummary.dayCounts[category.id] ?? 0, href: reportHref(month, full, "list", { category: category.id }) }));
  if (categorySummary.uncategorizedMinutes > 0) composition.unshift({ key: "uncategorized", label: he.report.uncategorized, minutes: categorySummary.uncategorizedMinutes, days: categorySummary.uncategorizedDays, href: reportHref(month, full, "list", { category: "uncategorized" }) });
  if (fridayMinutes > 0) composition.push({ key: "friday", label: he.report.fridayWork, minutes: fridayMinutes, days: fridayDays.length, href: reportHref(month, full, "list", { status: "friday" }) });
  if (vacationDays > 0) composition.push({ key: "vacation", label: he.report.vacationDays, minutes: vacationMinutes, days: vacationDays, href: reportHref(month, full, "list", { status: "vacation" }) });
  if (sickDays > 0) composition.push({ key: "sick", label: he.report.sickDays, minutes: sickMinutes, days: sickDays, href: reportHref(month, full, "list", { status: "sick" }) });

  let visibleDays = days;
  let filterLabel: string | undefined;
  if (weekFilter) {
    const week = analytics.weeks.find((item) => item.key === weekFilter);
    if (week) {
      visibleDays = days.filter((day) => day.date >= week.startDate && day.date <= week.endDate);
      filterLabel = `${he.report.week} ${week.number}`;
    }
  } else if (categoryFilter === "uncategorized") {
    visibleDays = days.filter((day) => (categorySummary.uncategorizedByDate[day.date] ?? 0) > 0);
    filterLabel = he.report.uncategorized;
  } else if (categoryFilter && categoryNames.has(categoryFilter)) {
    visibleDays = days.filter((day) => (categorySummary.byDate[day.date]?.[categoryFilter] ?? 0) > 0);
    filterLabel = categoryNames.get(categoryFilter);
  } else if (statusFilter === "friday") {
    visibleDays = fridayDays;
    filterLabel = he.report.fridayWork;
  } else if (statusFilter) {
    visibleDays = days.filter((day) => analytics.statusByDate[day.date] === statusFilter);
    filterLabel = reportStatusLabel(statusFilter as ReportDayStatus);
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="muted text-sm">{he.report.pageSubtitle}</p><h1 className="text-3xl font-extrabold">{he.report.title}</h1></div>
        <ReportActions month={month} />
      </header>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-3">
        <Link aria-label={he.report.nextMonth} className="grid size-12 place-items-center rounded-full bg-[var(--background)]" href={reportHref(shiftMonth(month, 1), full, view)}><ChevronRight aria-hidden /></Link>
        <div className="text-center"><h2 className="text-xl font-extrabold">{monthLabel}</h2><Link className="text-sm font-bold text-[var(--primary)]" href={reportHref(current, false, view)}>{he.report.currentMonth}</Link></div>
        <Link aria-label={he.report.previousMonth} className="grid size-12 place-items-center rounded-full bg-[var(--background)]" href={reportHref(shiftMonth(month, -1), full, view)}><ChevronLeft aria-hidden /></Link>
      </section>

      <div className="no-print mx-auto flex rounded-full bg-[var(--surface-muted)] p-1" role="group" aria-label={he.report.rangeLabel}>
        <Link href={reportHref(month, false, view)} className={"min-h-11 rounded-full px-5 py-2.5 font-bold " + (!full ? "bg-white text-[var(--primary)] shadow-sm" : "muted")}>{he.report.toDate}</Link>
        <Link href={reportHref(month, true, view)} className={"min-h-11 rounded-full px-5 py-2.5 font-bold " + (full ? "bg-white text-[var(--primary)] shadow-sm" : "muted")}>{he.report.fullMonth}</Link>
      </div>

      <ReportOverview analytics={analytics} month={month} full={full} composition={composition} />

      {compensation.visible && <section className="card flex flex-wrap items-center gap-4 p-5" aria-label={he.report.compensation}>
        <span className="grid size-11 place-items-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]"><Coins aria-hidden /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">{he.report.compensation}</p><strong className="metric-value mt-1 block text-xl text-[var(--success)]">{formatCurrency(compensation.amount)}</strong><p className="muted mt-1 text-xs">{compensationDetail}</p></div>
      </section>}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">{he.report.daily}</h2>
          <div className="no-print flex rounded-full bg-[var(--surface-muted)] p-1" role="group" aria-label={he.report.chooseView}>
            <Link href={reportHref(month, full, "list")} className={"flex min-h-11 items-center gap-2 rounded-full px-4 py-2 font-bold " + (view === "list" ? "bg-white text-[var(--primary)] shadow-sm" : "muted")}><LayoutList aria-hidden size={18} />{he.report.listView}</Link>
            <Link href={reportHref(month, full, "calendar")} className={"flex min-h-11 items-center gap-2 rounded-full px-4 py-2 font-bold " + (view === "calendar" ? "bg-white text-[var(--primary)] shadow-sm" : "muted")}><CalendarDays aria-hidden size={18} />{he.report.calendarView}</Link>
          </div>
        </div>

        {filterLabel && <div className="no-print mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--primary-soft)] px-4 py-3 text-sm font-bold text-[var(--primary)]"><span>{he.report.activeFilter}: {filterLabel}</span><Link href={reportHref(month, full, "list")} className="min-h-11 rounded-full bg-white px-4 py-2.5">{he.report.clearFilter}</Link></div>}

        {view === "calendar" ? (
          <CalendarView days={days} statusByDate={analytics.statusByDate} month={month} full={full} entriesByDate={entriesByDate} categoryByDate={categorySummary.byDate} categoryNames={categoryNames} />
        ) : (
          <ListView focusDate={focusDate} days={visibleDays} statusByDate={analytics.statusByDate} filtered={Boolean(filterLabel)} entriesByDate={entriesByDate} categoryByDate={categorySummary.byDate} categoryNames={categoryNames} categories={categories} timezone={timezone} />
        )}
      </section>
    </div>
  );
}

function ListView({ focusDate, days, statusByDate, filtered, entriesByDate, categoryByDate, categoryNames, categories, timezone }: {
  focusDate?: string;
  days: ReportDay[];
  statusByDate: Record<string, ReportDayStatus>;
  filtered: boolean;
  entriesByDate: Record<string, ReportEntry[]>;
  categoryByDate: Record<string, Record<string, number>>;
  categoryNames: Map<string, string>;
  categories: EntryFormCategory[];
  timezone: string;
}) {
  if (!days.length) return <div className="card p-8 text-center"><p className="font-bold">{filtered ? he.report.filteredEmpty : he.report.empty}</p></div>;
  const headers = [he.report.date, he.report.status, he.report.expected, he.report.worked, he.report.adjustments, he.report.balance, he.report.entriesCount, he.report.edit];
  return (
    <>
      <ReportDayFocus date={focusDate} />
      <div className="grid gap-3 md:hidden">
        {days.map((day) => <DayCard key={day.date} day={day} status={statusByDate[day.date]} entries={entriesByDate[day.date] ?? []} categoryMinutes={categoryByDate[day.date] ?? {}} categoryNames={categoryNames} categories={categories} timezone={timezone} />)}
      </div>
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-[var(--primary-soft)] text-[var(--primary)]">
            <tr>{headers.map((header, index) => <th className={"p-3 align-middle " + (index < 2 ? "text-start" : "text-center")} key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr tabIndex={-1} data-report-date={day.date} data-date={day.date} key={day.date} className="border-t border-[var(--border-soft)]">
                <td className="p-3 text-start align-middle font-bold">{new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "numeric" }).format(new Date(day.date + "T12:00:00Z"))}</td>
                <td className="p-3 text-start align-middle"><StatusBadge status={statusByDate[day.date]} label={day.holidayLabel ?? reportStatusLabel(statusByDate[day.date])} /></td>
                <td className="p-3 text-center align-middle"><MinuteValue minutes={day.expectedMinutes} /></td>
                <td className="p-3 text-center align-middle"><MinuteValue minutes={day.workedMinutes} /></td>
                <td className="p-3 text-center align-middle"><MinuteValue minutes={day.manualAdjustmentMinutes} /></td>
                <td className="p-3 text-center align-middle font-bold"><MinuteValue minutes={day.finalBalanceMinutes} /></td>
                <td className="p-3 text-center align-middle">{day.sessions}</td>
                <td className="p-2 text-center align-middle"><DayEntryActions date={day.date} entries={entriesByDate[day.date] ?? []} categories={categories} timezone={timezone} allowAdd={!day.future} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CalendarView({ days, statusByDate, month, full, entriesByDate, categoryByDate, categoryNames }: {
  days: ReportDay[];
  statusByDate: Record<string, ReportDayStatus>;
  month: string;
  full: boolean;
  entriesByDate: Record<string, ReportEntry[]>;
  categoryByDate: Record<string, Record<string, number>>;
  categoryNames: Map<string, string>;
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
                {!day.future && <Link aria-label={he.report.editDay + " " + day.date} href={reportHref(month, full, "list") + "&editDate=" + day.date} className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]"><Pencil aria-hidden size={16} /></Link>}
              </div>
              <p className="mt-2 text-center text-xs font-bold sm:text-sm"><MinuteValue minutes={day.workedMinutes} /></p><p className="mt-1 truncate text-center text-[10px] font-bold" title={day.holidayLabel ?? reportStatusLabel(statusByDate[day.date])}>{day.holidayLabel ?? reportStatusLabel(statusByDate[day.date])}</p>
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

function DayCard({ day, status, entries, categoryMinutes, categoryNames, categories, timezone }: {
  day: ReportDay;
  status: ReportDayStatus;
  entries: ReportEntry[];
  categoryMinutes: Record<string, number>;
  categoryNames: Map<string, string>;
  categories: EntryFormCategory[];
  timezone: string;
}) {
  return (
    <article tabIndex={-1} data-report-date={day.date} data-date={day.date} className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-extrabold">{new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(day.date + "T12:00:00Z"))}</h3><p className="muted text-sm">{day.sessions ? day.sessions + " " + he.report.entriesCount : he.report.noEntries}</p></div>
        <StatusBadge status={status} label={day.holidayLabel ?? reportStatusLabel(status)} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div><dt className="muted text-xs">{he.report.expected}</dt><dd className="font-bold"><MinuteValue minutes={day.expectedMinutes} /></dd></div>
        <div><dt className="muted text-xs">{he.report.worked}</dt><dd className="font-bold"><MinuteValue minutes={day.workedMinutes} /></dd></div>
        <div><dt className="muted text-xs">{he.report.balance}</dt><dd className="font-bold"><MinuteValue minutes={day.finalBalanceMinutes} /></dd></div>
      </dl>
      {Object.keys(categoryMinutes).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{Object.entries(categoryMinutes).map(([categoryId, minutes]) => <span key={categoryId} className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold text-[var(--primary)]">{categoryNames.get(categoryId)} · {formatMinutes(minutes)}</span>)}</div>}
      <div className="mt-3 border-t border-[var(--border-soft)] pt-3"><DayEntryActions date={day.date} entries={entries} categories={categories} timezone={timezone} allowAdd={!day.future} /></div>
    </article>
  );
}

function DayEntryActions({ date, entries, categories, timezone, allowAdd }: { date: string; entries: ReportEntry[]; categories: EntryFormCategory[]; timezone: string; allowAdd: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {entries.map((entry) => <EntryForm key={entry.id} compact ariaLabel={he.report.editEntry + " " + formatTime(entry.clock_in)} categories={categories} timezone={timezone} entry={editableEntry(entry, timezone)} />)}
      {allowAdd && <EntryForm compact ariaLabel={he.entries.add + " " + date} categories={categories} timezone={timezone} initialDate={date} />}
    </div>
  );
}

function MinuteValue({ minutes }: { minutes: number }) {
  return <span className="metric-value inline-flex min-w-[6.5ch] justify-center text-center" dir="ltr">{formatMinutes(minutes)}</span>;
}
function reportStatusLabel(status: ReportDayStatus) {
  if (status === "future") return he.report.future;
  if (status === "inProgress") return he.report.inProgress;
  if (status === "holiday") return he.status.holiday;
  if (status === "shortened") return he.status.shortened;
  if (status === "vacation") return he.status.vacation;
  if (status === "sick") return he.status.sick;
  if (status === "incomplete") return he.report.statusIncomplete;
  if (status === "missingReport") return he.report.statusMissingReport;
  if (status === "missingHours") return he.report.statusMissingHours;
  if (status === "overtime") return he.status.overtime;
  if (status === "nonWorkday") return he.report.statusNonWorkday;
  return he.report.completed;
}

function StatusBadge({ status, label }: { status: ReportDayStatus; label: string }) {
  const tone = status === "missingReport" || status === "incomplete"
    ? "bg-[var(--error-soft)] text-[var(--error)]"
    : status === "missingHours"
      ? "bg-[var(--warning-soft)] text-[var(--warning)]"
      : status === "completed" || status === "overtime"
        ? "bg-[var(--success-soft)] text-[var(--success)]"
        : status === "future" || status === "nonWorkday"
          ? "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
          : "bg-[var(--primary-soft)] text-[var(--primary)]";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}
