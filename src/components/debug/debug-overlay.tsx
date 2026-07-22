"use client";

import { useEffect, useState } from "react";
import { Bug, Trash2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ClientDebugEvent } from "@/lib/debug/client";
import { safeRequestLabel, sanitizeDebugText } from "@/lib/debug/sanitize";
import { he } from "@/lib/i18n/he";

type DebugEntry = ClientDebugEvent & { id: number; time: string };

export function DebugOverlay({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<DebugEntry[]>([]);

  function add(entry: ClientDebugEvent) {
    setEntries((current) => [
      { ...entry, message: sanitizeDebugText(entry.message), id: Date.now() + Math.random(), time: new Date().toLocaleTimeString("he-IL", { hour12: false }) },
      ...current,
    ].slice(0, 50));
  }

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => add({ scope: he.debug.route, status: "info", message: pathname }), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;

    const onDebug = (event: Event) => add((event as CustomEvent<ClientDebugEvent>).detail);
    const onError = (event: ErrorEvent) => add({ scope: he.debug.runtime, status: "error", message: event.message || he.status.error });
    const onRejection = (event: PromiseRejectionEvent) => add({
      scope: he.debug.runtime,
      status: "error",
      message: event.reason instanceof Error ? event.reason.message : he.status.error,
    });
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const started = performance.now();
      const method = args[1]?.method ?? (args[0] instanceof Request ? args[0].method : "GET");
      const label = safeRequestLabel(args[0]);
      try {
        const response = await originalFetch(...args);
        add({
          scope: he.debug.request,
          status: response.ok ? "ok" : "error",
          message: `${method.toUpperCase()} ${label} · ${response.status} · ${Math.round(performance.now() - started)}ms`,
        });
        return response;
      } catch (error) {
        add({ scope: he.debug.request, status: "error", message: `${method.toUpperCase()} ${label} · network_error` });
        throw error;
      }
    };

    window.addEventListener("clockin:debug", onDebug);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("clockin:debug", onDebug);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside className="no-print fixed bottom-4 left-4 z-[1000]" dir="rtl">
      {open && (
        <div className="mb-3 flex max-h-[min(70dvh,560px)] w-[min(calc(100vw-2rem),390px)] flex-col overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-[var(--border-soft)] p-4">
            <div><h2 className="font-extrabold">{he.debug.title}</h2><p className="muted text-xs">{he.debug.localOnly}</p></div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full bg-[var(--surface-muted)]" aria-label={he.debug.close}><X aria-hidden /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-3">
            {entries.length === 0 ? <p className="muted p-4 text-center text-sm">{he.debug.empty}</p> : (
              <ol className="grid gap-2">
                {entries.map((entry) => (
                  <li key={entry.id} className="rounded-2xl bg-[var(--background)] p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <b>{entry.scope}</b>
                      <span className={entry.status === "error" ? "text-[var(--error)]" : entry.status === "ok" ? "text-[var(--success)]" : "muted"}>{entry.status === "error" ? he.debug.error : entry.status === "ok" ? he.debug.ok : entry.time}</span>
                    </div>
                    <p className="break-words font-mono text-xs" dir="ltr">{entry.message}</p>
                    {entry.status !== "info" && <time className="muted mt-1 block text-xs">{entry.time}</time>}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <button type="button" onClick={() => setEntries([])} className="flex min-h-11 items-center justify-center gap-2 border-t border-[var(--border-soft)] p-3 font-bold text-[var(--primary)]"><Trash2 className="size-4" aria-hidden />{he.debug.clear}</button>
        </div>
      )}
      <button type="button" disabled={!ready} onClick={() => setOpen((value) => !value)} className="grid size-12 place-items-center rounded-full bg-[var(--primary)] text-white shadow-xl" aria-expanded={open} aria-label={open ? he.debug.close : he.debug.open}><Bug aria-hidden /></button>
    </aside>
  );
}
