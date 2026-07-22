"use client";

import { useEffect } from "react";
import { AlertTriangle, House, RotateCcw } from "lucide-react";
import { emitDebugEvent } from "@/lib/debug/client";
import { he } from "@/lib/i18n/he";

export function ErrorState({ error, reset, fullPage = false }: { error: Error & { digest?: string }; reset: () => void; fullPage?: boolean }) {
  useEffect(() => {
    console.error("[clockin-ui]", error);
    emitDebugEvent({ scope: he.debug.runtime, status: "error", message: error.digest ?? error.message });
  }, [error]);

  const content = (
    <section role="alert" className="card mx-auto grid w-full max-w-xl justify-items-center gap-4 p-6 text-center sm:p-10">
      <span className="grid size-14 place-items-center rounded-2xl bg-[var(--error-soft)] text-[var(--error)]">
        <AlertTriangle aria-hidden size={28} />
      </span>
      <div>
        <h1 className="text-2xl font-extrabold">{fullPage ? he.errors.unexpectedTitle : he.errors.dataLoadTitle}</h1>
        <p className="muted mt-2">{fullPage ? he.errors.unexpectedDescription : he.errors.dataLoadDescription}</p>
        {error.digest && <p className="muted mt-2 text-xs">{he.errors.reference}: <b dir="ltr">{error.digest}</b></p>}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="button-primary" onClick={reset}><RotateCcw aria-hidden size={18} />{he.errors.retry}</button>
        <a className="button-secondary" href="/app"><House aria-hidden size={18} />{he.errors.home}</a>
      </div>
    </section>
  );

  return fullPage ? <main id="main-content" className="grid min-h-dvh place-items-center p-4">{content}</main> : content;
}
