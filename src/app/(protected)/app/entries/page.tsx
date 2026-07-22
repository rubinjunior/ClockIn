import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, FilePenLine, Tag } from "lucide-react";
import { EntryForm, type EntryFormCategory } from "@/components/entries/entry-form";
import { createClient } from "@/lib/supabase/server";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { requireUser } from "@/lib/supabase/session";
import { formatLocalDate, formatMinutes, formatTime } from "@/lib/formatting";
import { demoEntries, isDemoMode } from "@/lib/demo";
import { he } from "@/lib/i18n/he";
import { israelMonth } from "@/lib/time/israel";

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

export default async function EntriesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : israelMonth();
  const start = month + "-01T00:00:00.000Z";
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

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
    const supabase = await createClient();
    const [entriesResult, categoriesResult, profileResult] = await Promise.all([
      supabase.from("time_entries").select("id,clock_in,clock_out,source,note,edit_reason,category_id,updated_at,created_at").gte("clock_in", start).lt("clock_in", end.toISOString()).is("deleted_at", null).order("clock_in", { ascending: false }),
      supabase.from("work_categories").select("id,name,is_active").order("sort_order").order("created_at"),
      supabase.from("profiles").select("timezone").eq("id", user.id).single(),
    ]);
    requireSuccessfulQueries("entries", [entriesResult, categoriesResult, profileResult]);
    entries = entriesResult.data;
    error = entriesResult.error;
    categories = (categoriesResult.data ?? []).map((category) => ({ id: category.id, name: category.name, isActive: category.is_active }));
    timezone = profileResult.data?.timezone ?? timezone;
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="muted text-sm">ניהול ותיקון שעות</p><h1 className="text-3xl font-extrabold">{he.entries.title}</h1></div>
        <EntryForm categories={categories} timezone={timezone} />
      </header>

      <form className="card flex flex-wrap items-center gap-3 p-4">
        <label htmlFor="month" className="font-bold">בחירת חודש</label>
        <input id="month" name="month" type="month" defaultValue={month} className="input max-w-52" />
        <button className="button-secondary">הצגה</button>
      </form>

      {error ? (
        <section className="card p-8 text-center"><p className="font-bold text-[var(--error)]">לא ניתן לטעון את הנתונים</p><a className="button-secondary mt-4" href="/app/entries">{he.common.retry}</a></section>
      ) : entries?.length ? (
        <section className="grid gap-3">
          {entries.map((entry) => {
            const minutes = entry.clock_out ? Math.round((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000) : null;
            return (
              <article className="card p-4 sm:p-5" key={entry.id}>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><CalendarClock aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-extrabold">{formatLocalDate(entry.clock_in)}</h2>
                        <p className="muted metric-value mt-1 text-sm">{formatTime(entry.clock_in)}–{entry.clock_out ? formatTime(entry.clock_out) : "דיווח פתוח"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <b className="metric-value text-lg">{minutes === null ? he.entries.active : formatMinutes(minutes)}</b>
                        {entry.clock_out && <EntryForm compact categories={categories} timezone={timezone} entry={{
                          id: entry.id,
                          clockInLocal: formatInTimeZone(entry.clock_in, timezone, "yyyy-MM-dd'T'HH:mm"),
                          clockOutLocal: formatInTimeZone(entry.clock_out, timezone, "yyyy-MM-dd'T'HH:mm"),
                          categoryId: entry.category_id,
                          note: entry.note,
                        }} />}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-[var(--background)] px-3 py-1.5">{entry.source === "manual" ? he.entries.manual : "שעון עבודה"}</span>
                      {entry.category_id && <span className="flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 font-bold text-[var(--primary)]"><Tag aria-hidden size={13} />{categoryNames.get(entry.category_id) ?? he.categories.archived}</span>}
                      {entry.updated_at !== entry.created_at && <span className="rounded-full bg-[var(--warning-soft)] px-3 py-1.5 text-[var(--warning)]">נערך</span>}
                      {entry.note && <span className="muted flex items-center gap-1"><FilePenLine aria-hidden size={14} />{entry.note}</span>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="card p-10 text-center"><CalendarClock className="mx-auto text-[var(--primary)]" size={40} aria-hidden /><h2 className="mt-4 text-xl font-extrabold">{he.entries.empty}</h2><p className="muted mt-1">אפשר להוסיף דיווח ידני או להתחיל שעון מהמסך הראשי</p></section>
      )}
    </div>
  );
}