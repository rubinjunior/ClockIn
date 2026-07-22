"use client";
import { useEffect, useState, useTransition } from "react";
import { CircleStop, Play, TimerReset } from "lucide-react";
import { startClock, stopClock } from "@/actions/clock-actions";
import { formatDuration, formatMinutes, formatTime } from "@/lib/formatting";
import { he } from "@/lib/i18n/he";

export function LiveClockCard({ activeClockIn, workedMinutes = 0, expectedMinutes = 510 }: { activeClockIn?: string | null; workedMinutes?: number; expectedMinutes?: number }) {
  const [clockIn, setClockIn] = useState(activeClockIn ?? null);
  const [now, setNow] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  useEffect(() => { const sync = () => setNow(Date.now()); const initial = window.setTimeout(sync, 0); const timer = window.setInterval(sync, clockIn ? 1000 : 60000); document.addEventListener("visibilitychange", sync); return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener("visibilitychange", sync); }; }, [clockIn]);
  const elapsed = clockIn && now ? Math.max(0, Math.floor((now - new Date(clockIn).getTime()) / 1000)) : 0;
  const toggle = () => startTransition(async () => { setMessage(""); const result = clockIn ? await stopClock() : await startClock(); setMessage(result.message); if (result.ok) setClockIn(clockIn ? null : String(result.entry?.clock_in ?? new Date().toISOString())); });
  return <section className="glass overflow-hidden rounded-[28px] p-5 sm:p-8" aria-labelledby="clock-title"><div className="flex items-start justify-between gap-4"><div><div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--success)]"><span className={clockIn ? "status-dot" : "size-2 rounded-full bg-[var(--surface-muted)]"}/>{clockIn ? he.clock.active : he.clock.inactive}</div><h2 id="clock-title" className="text-lg font-bold">{he.dashboard.title}</h2></div><TimerReset className="text-[var(--primary)]" aria-hidden size={28}/></div>
    <div className="py-8 text-center"><p className="metric-value text-5xl font-extrabold tracking-[-.05em] text-[var(--primary)] sm:text-7xl">{clockIn ? formatDuration(elapsed) : now ? new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now) : "--:--"}</p>{clockIn && <p className="muted mt-3">{he.clock.startedAt}: <b className="metric-value text-[var(--text-primary)]">{formatTime(clockIn)}</b></p>}</div>
    <div className="mb-6 grid grid-cols-3 gap-2 text-center"><Metric label="היום" value={formatMinutes(workedMinutes + Math.floor(elapsed / 60))}/><Metric label={he.clock.expected} value={formatMinutes(expectedMinutes)}/><Metric label={he.clock.balance} value={formatMinutes(workedMinutes + Math.floor(elapsed / 60) - expectedMinutes)} /></div>
    <button onClick={toggle} disabled={pending} className={`w-full ${clockIn ? "button-danger" : "button-primary"}`}>{clockIn ? <CircleStop aria-hidden/> : <Play aria-hidden/>}{pending ? "מעדכן..." : clockIn ? he.clock.stop : he.clock.start}</button><p className="sr-only" aria-live="polite">{message}</p>
  </section>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/75 p-3"><p className="muted text-xs">{label}</p><p className="metric-value mt-1 font-bold">{value}</p></div>; }
