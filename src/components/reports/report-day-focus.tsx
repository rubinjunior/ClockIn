"use client";

import { useEffect } from "react";

export function ReportDayFocus({ date }: { date?: string }) {
  useEffect(() => {
    if (!date) return;
    const timer = window.setTimeout(() => {
      const candidates = document.querySelectorAll<HTMLElement>(`[data-report-date="${CSS.escape(date)}"]`);
      const target = [...candidates].find((element) => element.getClientRects().length > 0);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [date]);

  return null;
}