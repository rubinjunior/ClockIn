import { Bell, CalendarDays, ChevronLeft, HeartPulse, Palmtree, Settings, Timer } from "lucide-react";
import Link from "next/link";
import { LiveClockCard } from "@/components/clock/live-clock-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { formatLocalDate, formatMinutes, formatTime } from "@/lib/formatting";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/session";
import { demoEntries, isDemoMode } from "@/lib/demo";
import { cookies } from "next/headers";

export default async function DashboardPage() {
  const user = await requireUser();
  let profile: { username: string } | null = null;
  let active: { clock_in: string } | null = null;
  let recent: Array<{ id: string; clock_in: string; clock_out: string | null }> = [];
  if (isDemoMode()) {
    profile = { username: user.user_metadata.username };
    const activeValue = (await cookies()).get("clockin_demo_active")?.value;
    active = activeValue ? { clock_in: activeValue } : null;
    recent = demoEntries().map((entry) => ({ id: entry.id, clock_in: entry.clockIn, clock_out: entry.clockOut }));
  } else {
    const supabase = await createClient();
    const results = await Promise.all([
      supabase.from("profiles").select("username").eq("id", user.id).single(),
      supabase.from("time_entries").select("id,clock_in").is("clock_out", null).is("deleted_at", null).maybeSingle(),
      supabase.from("time_entries").select("id,clock_in,clock_out").not("clock_out", "is", null).is("deleted_at", null).order("clock_in", { ascending: false }).limit(3),
    ]);
    profile = results[0].data; active = results[1].data; recent = results[2].data ?? [];
  }
  const username = profile?.username ?? user.user_metadata.username ?? "חבר";
  return <div className="grid gap-6"><header className="flex items-start justify-between gap-4"><div><p className="muted text-sm">{formatLocalDate(new Date())}</p><h1 className="mt-1 text-3xl font-extrabold">שלום, {username}</h1></div><Link href="/app/settings" aria-label="פתיחת הגדרות" className="grid size-12 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-sm"><Settings aria-hidden size={22}/></Link></header>
    <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_.7fr]"><LiveClockCard activeClockIn={active?.clock_in}/><div className="grid grid-cols-2 gap-3"><SummaryCard icon={Timer} label="סיכום השבוע" value="32:40" detail="מתוך 42:30"/><SummaryCard icon={Palmtree} label="יתרת חופשה" value="8.5 ימים" tone="success"/><SummaryCard icon={HeartPulse} label="יתרת מחלה" value="12 ימים"/><SummaryCard icon={Bell} label="התזכורת הבאה" value="17:05" detail="סיום עבודה" tone="warning"/></div></div>
    <section className="card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-extrabold">דיווחים אחרונים</h2><p className="muted text-sm">הימים האחרונים שלך במבט אחד</p></div><Link href="/app/entries" className="button-secondary !min-h-11 !px-4">לכל הדיווחים<ChevronLeft aria-hidden size={18}/></Link></div>{recent?.length ? <div className="grid gap-2">{recent.map((entry) => <article key={entry.id} className="flex items-center gap-3 rounded-2xl bg-[var(--background)] p-3"><span className="grid size-11 place-items-center rounded-2xl bg-white text-[var(--primary)]"><CalendarDays aria-hidden size={20}/></span><div className="min-w-0 flex-1"><p className="font-bold">{formatLocalDate(entry.clock_in, { dateStyle: "medium" })}</p><p className="muted metric-value text-sm">{formatTime(entry.clock_in)}–{entry.clock_out ? formatTime(entry.clock_out) : "פתוח"}</p></div><b className="metric-value">{entry.clock_out ? formatMinutes(Math.round((new Date(entry.clock_out).getTime()-new Date(entry.clock_in).getTime())/60000)) : "פעיל"}</b></article>)}</div> : <div className="rounded-2xl bg-[var(--background)] p-7 text-center"><CalendarDays className="mx-auto text-[var(--primary)]" aria-hidden/><p className="mt-3 font-bold">עדיין אין דיווחים</p><p className="muted text-sm">הדיווח הראשון יופיע כאן אחרי סיום יום העבודה</p></div>}</section>
  </div>;
}
