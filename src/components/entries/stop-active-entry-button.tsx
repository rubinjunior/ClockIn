"use client";

import { useState, useTransition } from "react";
import { Square } from "lucide-react";
import { stopClock } from "@/actions/clock-actions";
import { he } from "@/lib/i18n/he";

export function StopActiveEntryButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function stop() {
    setMessage("");
    startTransition(async () => {
      const result = await stopClock();
      setMessage(result.message);
    });
  }

  return (
    <div className="grid justify-items-end gap-2">
      <button type="button" className="button-primary" disabled={pending} onClick={stop}>
        <Square aria-hidden size={16} fill="currentColor" />
        {pending ? he.entries.stopping : he.entries.stopActive}
      </button>
      {message && <p role="status" className="text-sm font-bold text-[var(--primary)]">{message}</p>}
    </div>
  );
}
