"use client";

import { useEffect, useState } from "react";

const keys = { reducedMotion: "clockin-reduced-motion", readability: "clockin-readability" } as const;

export function AccessibilitySettings() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [readability, setReadability] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReducedMotion(localStorage.getItem(keys.reducedMotion) === "true");
      setReadability(localStorage.getItem(keys.readability) === "true");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
    document.documentElement.classList.toggle("high-readability", readability);
    localStorage.setItem(keys.reducedMotion, String(reducedMotion));
    localStorage.setItem(keys.readability, String(readability));
  }, [ready, reducedMotion, readability]);

  return <div className="grid gap-3">
    <Preference label="הפחתת תנועה" description="מבטל מעברים ואנימציות שאינן חיוניות" checked={reducedMotion} onChange={setReducedMotion} />
    <Preference label="קריאות גבוהה" description="מגדיל טקסט ומחזק ניגודיות" checked={readability} onChange={setReadability} />
    <p role="status" className="muted text-sm">העדפות הנגישות נשמרות במכשיר הזה.</p>
  </div>;
}

function Preference({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-16 items-center justify-between gap-4 rounded-2xl bg-[var(--background)] p-4"><span><b>{label}</b><small className="muted block">{description}</small></span><input type="checkbox" className="size-5 accent-[var(--primary)]" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}