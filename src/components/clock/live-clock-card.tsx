"use client";

import { useEffect, useState, useTransition } from "react";
import { CircleStop, Play, TimerReset } from "lucide-react";
import { startClock, stopClock } from "@/actions/clock-actions";
import { formatDuration, formatMinutes, formatTime } from "@/lib/formatting";
import { he } from "@/lib/i18n/he";

export function LiveClockCard({ activeClockIn, workedMinutes = 0, expectedMinutes = 0 }: { activeClockIn?: string | null; workedMinutes?: number; expectedMinutes?: number }) {
  const [clockIn, setClockIn] = useState(activeClockIn ?? null);
  const [now, setNow] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const sync = () => setNow(Date.now());
    const initial = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, clockIn ? 1000 : 60_000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [clockIn]);

  const elapsed = clockIn && now ? Math.max(0, Math.floor((now - new Date(clockIn).getTime()) / 1000)) : 0;
  const currentWorked = workedMinutes + Math.floor(elapsed / 60);
  const balance = currentWorked - expectedMinutes;

  function toggle() {
    startTransition(async () => {
      setFeedback(null);
      const result = clockIn ? await stopClock() : await startClock();
      setFeedback({ ok: result.ok, message: result.message });
      if (result.ok) setClockIn(clockIn ? null : String(result.entry?.clock_in ?? new Date().toISOString()));
    });
  }

  return <section className="glass overflow-hidden rounded-[28px] p-5 sm:p-8" aria-labelledby="clock-title">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className={"mb-3 flex items-center gap-2 text-sm font-bold " + (clockIn ? "text-[var(--success)]" : "text-[var(--text-secondary)]")}>
          <span className={clockIn ? "status-dot is-active" : "size-2 rounded-full bg-[var(--surface-muted)]"}/>
          {clockIn ? he.clock.active : he.clock.inactive}
        </div>
        <h2 id="clock-title" className="text-lg font-bold">{he.dashboard.title}</h2>
      </div>
      <span className="clock-orbit" aria-hidden><TimerReset className="text-[var(--primary)]" size={24}/></span>
    </div>
    <div className="py-8 text-center">
      <time className="metric-value block text-5xl font-extrabold tracking-[-.05em] text-[var(--primary)] sm:text-7xl" dateTime={clockIn ? `PT${elapsed}S` : undefined}>{clockIn ? formatDuration(elapsed) : now ? new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now) : "--:--"}</time>
      {clockIn && <p className="muted mt-3">{he.clock.startedAt}: <b className="metric-value text-[var(--text-primary)]">{formatTime(clockIn)}</b></p>}
    </div>
    <div className="mb-6 grid grid-cols-3 gap-2 text-center">
      <Metric label={he.clock.today} value={formatMinutes(currentWorked)}/>
      <Metric label={he.clock.expected} value={formatMinutes(expectedMinutes)}/>
      <Metric label={he.clock.balance} value={formatMinutes(balance)} tone={balance < 0 ? "error" : "success"}/>
    </div>
    <button onClick={toggle} disabled={pending} className={`w-full ${clockIn ? "button-danger" : "button-primary"}`}>
      {pending ? <span className="spinner" aria-hidden /> : clockIn ? <CircleStop aria-hidden/> : <Play aria-hidden/>}
      {pending ? he.clock.updating : clockIn ? he.clock.stop : he.clock.start}
    </button>
    {feedback && <p role={feedback.ok ? "status" : "alert"} className={`mt-3 rounded-2xl p-3 text-center text-sm font-bold ${feedback.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--error-soft)] text-[var(--error)]"}`}>{feedback.message}</p>}
  </section>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "error" }) {
  const toneClass = tone === "success" ? "text-[var(--success)]" : tone === "error" ? "text-[var(--error)]" : "";
  return <div className="min-w-0 rounded-2xl bg-white/75 p-3"><p className="muted truncate text-xs">{label}</p><p className={`metric-value mt-1 truncate font-bold ${toneClass}`}>{value}</p></div>;
}