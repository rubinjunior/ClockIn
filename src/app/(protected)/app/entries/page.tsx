import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, ChevronLeft, ChevronRight, FilePenLine, ListChecks, Tag, TimerReset } from "lucide-react";
import { EntryEditorProvider, EntryEditorTrigger } from "@/components/entries/entry-editor";
import type { EditableEntry, EntryFormCategory } from "@/components/entries/entry-form";
import { StopActiveEntryButton } from "@/components/entries/stop-active-entry-button";
import { createClient } from "@/lib/supabase/server";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { formatLocalDate, formatMinutes, formatTime } from "@/lib/formatting";
import { demoEntries, isDemoMode } from "@/lib/demo";
import { he } from "@/lib/i18n/he";
import { summarizeEntriesByDay } from "@/lib/entries/entry-summary";
import { israelMonth, israelToday } from "@/lib/time/israel";
import { monthUtcRange } from "@/lib/time/month-range";

type EntryRow = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  source: string;
  note: string | null;
  edit_reason: string | null;
  category_id: string | null;
  updated_at: string;
  created_at: string;
};


function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-15T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

function editableEntry(entry: EntryRow, timezone: string): EditableEntry | undefined {
  if (!entry.clock_out) return undefined;
  return {
    id: entry.id,
    clockInLocal: formatInTimeZone(entry.clock_in, timezone, "yyyy-MM-dd'T'HH:mm"),
    clockOutLocal: formatInTimeZone(entry.clock_out, timezone, "yyyy-MM-dd'T'HH:mm"),
    categoryId: entry.category_id,
    note: entry.note,
  };
}

export default async function EntriesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const currentMonth = israelMonth();
  const requestedMonth = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonth;
  const month = requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const { startsAt, endsAt } = monthUtcRange(month);

  let entries: EntryRow[] | null;
  let categories: EntryFormCategory[];
  let timezone = "Asia/Jerusalem";
  let error = null;

  if (isDemoMode()) {
    entries = demoEntries().map((entry) => ({
      id: entry.id,
      clock_in: entry.clockIn,
      clock_out: entry.clockOut,
      source: entry.source,
      note: entry.note ?? null,
      edit_reason: entry.edit_reason,
      category_id: entry.categoryId ?? null,
      updated_at: entry.updated_at,
      created_at: entry.created_at,
    }));
    categories = [];
  } else {
    const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
    const [entriesResult, categoriesResult] = await Promise.all([
      supabase.from("time_entries").select("id,clock_in,clock_out,source,note,edit_reason,category_id,updated_at,created_at").gte("clock_in", startsAt).lt("clock_in", endsAt).is("deleted_at", null).order("clock_in", { ascending: false }),
      supabase.from("work_categories").select("id,name,is_active").order("sort_order").order("created_at"),
    ]);
    requireSuccessfulQueries("entries", [entriesResult, categoriesResult]);
    entries = entriesResult.data;
    error = entriesResult.error;
    categories = (categoriesResult.data ?? []).map((category) => ({ id: category.id, name: category.name, isActive: category.is_active }));
    timezone = profile.timezone;
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const { days, totalMinutes, openEntries } = summarizeEntriesByDay(entries ?? [], timezone);
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const monthLabel = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "Asia/Jerusalem" }).format(new Date(`${month}-15T12:00:00Z`));
  const today = israelToday();

  return (
    <EntryEditorProvider categories={categories} timezone={timezone}>
      <div className="grid gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="muted text-sm">{he.entries.pageSubtitle}</p><h1 className="text-3xl font-extrabold">{he.entries.title}</h1></div>
          <EntryEditorTrigger ariaLabel={he.entries.add} showLabel />
        </header>

        <section className="card grid gap-4 p-4 sm:p-5" aria-labelledby="entries-month-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="muted text-sm">{he.entries.selectedMonth}</p><h2 id="entries-month-title" className="text-xl font-extrabold">{monthLabel}</h2></div>
            <div className="flex items-center gap-2">
              <Link href={`/app/entries?month=${previousMonth}`} className="grid size-11 place-items-center rounded-full bg-[var(--background)] text-[var(--primary)]" aria-label={he.entries.previousMonth}><ChevronRight aria-hidden /></Link>
              {nextMonth <= currentMonth ? <Link href={`/app/entries?month=${nextMonth}`} className="grid size-11 place-items-center rounded-full bg-[var(--background)] text-[var(--primary)]" aria-label={he.entries.nextMonth}><ChevronLeft aria-hidden /></Link> : <button type="button" disabled className="grid size-11 place-items-center rounded-full bg-[var(--background)] text-[var(--text-secondary)] opacity-40" aria-label={he.entries.noFutureMonths}><ChevronLeft aria-hidden /></button>}
            </div>
          </div>
          <form className="flex flex-wrap items-end gap-3">
            <label className="field min-w-48 flex-1 sm:max-w-60" htmlFor="entries-month"><span>{he.entries.chooseMonth}</span><input id="entries-month" name="month" type="month" max={currentMonth} defaultValue={month} className="input" /></label>
            <button className="button-secondary">{he.entries.showMonth}</button>
            {month !== currentMonth && <Link className="button-secondary" href="/app/entries">{he.entries.currentMonth}</Link>}
          </form>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={he.entries.monthSummary}>
          <SummaryCard icon={TimerReset} label={he.entries.monthWorked} value={formatMinutes(totalMinutes)} />
          <SummaryCard icon={CalendarClock} label={he.entries.reportingDays} value={String(days.length)} />
          <SummaryCard icon={ListChecks} label={he.entries.entriesCount} value={String(entries?.length ?? 0)} />
          <SummaryCard icon={CalendarClock} label={he.entries.openEntries} value={String(openEntries)} alert={openEntries > 0} />
        </section>

        {openEntries > 0 && <section role="status" className="card flex flex-wrap items-center justify-between gap-3 border border-[var(--warning)] p-4"><div><h2 className="font-extrabold text-[var(--warning)]">{he.entries.openEntryTitle}</h2><p className="muted text-sm">{he.entries.openEntryDescription}</p></div><StopActiveEntryButton /></section>}

        {error ? (
          <section className="card p-8 text-center"><p className="font-bold text-[var(--error)]">{he.errors.dataLoadTitle}</p><Link className="button-secondary mt-4" href="/app/entries">{he.common.retry}</Link></section>
        ) : days.length ? (
          <section className="grid gap-4" aria-labelledby="entries-list-title">
            <h2 id="entries-list-title" className="sr-only">{he.entries.dailyList}</h2>
            {days.map((day) => (
              <article className="card overflow-hidden" key={day.date}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-[var(--background)] p-4 sm:px-5">
                  <div><h3 className="font-extrabold">{formatLocalDate(day.entries[0].clock_in, { dateStyle: "full" })}</h3><p className="muted text-sm">{day.entries.length} {day.entries.length === 1 ? he.entries.singleEntry : he.entries.multipleEntries} · <b className="metric-value text-[var(--text-primary)]">{formatMinutes(day.minutes)}</b></p></div>
                  {day.date <= today && <EntryEditorTrigger initialDate={day.date} ariaLabel={`${he.entries.addForDay} ${day.date}`} />}
                </header>
                <div className="divide-y divide-[var(--border-soft)]">
                  {day.entries.map((entry) => {
                    const editable = editableEntry(entry, timezone);
                    const minutes = entry.clock_out ? Math.max(0, Math.round((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60_000)) : null;
                    return (
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:px-5" key={entry.id}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <p className="metric-value text-lg font-extrabold">{formatTime(entry.clock_in)}–{entry.clock_out ? formatTime(entry.clock_out) : he.entries.open}</p>
                            <b className={"metric-value " + (minutes === null ? "text-[var(--warning)]" : "text-[var(--primary)]")}>{minutes === null ? he.entries.active : formatMinutes(minutes)}</b>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-[var(--background)] px-3 py-1.5">{entry.source === "manual" ? he.entries.manual : he.entries.workClock}</span>
                            {entry.category_id && <span className="flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 font-bold text-[var(--primary)]"><Tag aria-hidden size={13} />{categoryNames.get(entry.category_id) ?? he.categories.archived}</span>}
                            {entry.updated_at !== entry.created_at && <span className="rounded-full bg-[var(--warning-soft)] px-3 py-1.5 text-[var(--warning)]">{he.entries.edited}</span>}
                            {entry.note && <span className="muted flex min-w-0 items-center gap-1"><FilePenLine aria-hidden size={14} /><span className="truncate">{entry.note}</span></span>}
                          </div>
                        </div>
                        {editable ? <EntryEditorTrigger entry={editable} ariaLabel={`${he.entries.edit} ${formatTime(entry.clock_in)}`} /> : <span className="size-11" aria-hidden />}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="card p-10 text-center"><CalendarClock className="mx-auto text-[var(--primary)]" size={40} aria-hidden /><h2 className="mt-4 text-xl font-extrabold">{he.entries.empty}</h2><p className="muted mt-1">{he.entries.emptyDescription}</p></section>
        )}
      </div>
    </EntryEditorProvider>
  );
}

function SummaryCard({ icon: Icon, label, value, alert = false }: { icon: typeof CalendarClock; label: string; value: string; alert?: boolean }) {
  return <article className={"card min-w-0 p-4 " + (alert ? "border border-[var(--warning)]" : "")}><Icon aria-hidden className={alert ? "text-[var(--warning)]" : "text-[var(--primary)]"} size={20} /><p className="muted mt-3 text-sm">{label}</p><b className="metric-value mt-1 block truncate text-xl">{value}</b></article>;
}