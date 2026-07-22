"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Download } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function decode(value: string) { const padding = "=".repeat((4 - value.length % 4) % 4); const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((character) => character.charCodeAt(0))); }

export function NotificationSettings() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => setEnabled(Boolean(subscription))).catch(() => undefined);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function enable() {
    setPending(true); setMessage("");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) { setMessage("ההתראות אינן נתמכות במכשיר הזה"); return; }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setMessage("הרשאת ההתראות לא ניתנה"); return; }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) { setMessage("מפתח ההתראות טרם הוגדר"); return; }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decode(key) });
      const response = await fetch("/api/notifications/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription) });
      if (!response.ok) { setMessage("לא ניתן להפעיל התראות"); return; }
      setEnabled(true);
      setMessage("ההתראות הופעלו");
    } catch { setMessage("לא ניתן להפעיל התראות במכשיר הזה"); }
    finally { setPending(false); }
  }

  async function disable() {
    setPending(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/notifications/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        if (!response.ok) { setMessage("לא ניתן לכבות את ההתראות"); return; }
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("ההתראות כובו במכשיר הזה");
    } catch { setMessage("לא ניתן לכבות את ההתראות"); }
    finally { setPending(false); }
  }

  async function test() {
    setPending(true); setMessage("");
    try { const response = await fetch("/api/notifications/test", { method: "POST" }); setMessage(response.ok ? "התראת הניסיון נשלחה" : "לא ניתן לשלוח התראת ניסיון"); }
    finally { setPending(false); }
  }

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setMessage(choice.outcome === "accepted" ? "ClockIn הותקנה" : "ההתקנה בוטלה");
      if (choice.outcome === "accepted") setInstallPrompt(null);
      return;
    }
    setMessage("במכשיר נייד: פותחים את תפריט השיתוף או הדפדפן ובוחרים הוספה למסך הבית");
  }

  return <div className="grid gap-3">
    <p className="muted text-sm">מצב במכשיר הזה: <b className={enabled ? "text-[var(--success)]" : "text-[var(--text-primary)]"}>{enabled ? "פעילות" : "כבויות"}</b></p>
    <div className="flex flex-wrap gap-2">
      {enabled ? <button type="button" disabled={pending} onClick={disable} className="button-danger"><BellOff aria-hidden />כיבוי התראות</button> : <button type="button" disabled={pending} onClick={enable} className="button-primary"><BellRing aria-hidden />הפעלת התראות</button>}
      <button type="button" disabled={pending || !enabled} onClick={test} className="button-secondary">שליחת התראת ניסיון</button>
    </div>
    <button type="button" className="button-secondary justify-self-start" onClick={install}><Download aria-hidden />התקנת ClockIn</button>
    {message && <p role="status" className="rounded-xl bg-[var(--primary-soft)] p-3 text-sm text-[var(--primary)]">{message}</p>}
  </div>;
}
