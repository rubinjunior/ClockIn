"use client";

import "./globals.css";
import { ErrorState } from "@/components/shared/error-state";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="he" dir="rtl"><body><ErrorState error={error} reset={reset} fullPage /></body></html>;
}
