"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { fromZonedTime } from "date-fns-tz";
import { saveEntry } from "@/actions/entry-actions";
import { he } from "@/lib/i18n/he";

export type EntryFormCategory = { id: string; name: string; isActive: boolean };
export type EditableEntry = {
  id: string;
  clockInLocal: string;
  clockOutLocal: string;
  categoryId: string | null;
  note?: string | null;
};

export function EntryForm({
  categories,
  entry,
  initialDate,
  compact = false,
  ariaLabel,
  timezone = "Asia/Jerusalem",
}: {
  categories: EntryFormCategory[];
  entry?: EditableEntry;
  initialDate?: string;
  compact?: boolean;
  ariaLabel?: string;
  timezone?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const defaultStart = entry?.clockInLocal ?? (initialDate ? initialDate + "T09:00" : "");
  const defaultEnd = entry?.clockOutLocal ?? (initialDate ? initialDate + "T17:00" : "");

  function submit(formData: FormData) {
    const clockIn = String(formData.get("clockInLocal"));
    const clockOut = String(formData.get("clockOutLocal"));
    formData.set("clockIn", fromZonedTime(clockIn, timezone).toISOString());
    formData.set("clockOut", fromZonedTime(clockOut, timezone).toISOString());
    startTransition(async () => {
      const result = await saveEntry(formData);
      setMessage(result.message ?? "");
      if (result.ok) dialog.current?.close();
    });
  }

  const triggerLabel = entry ? he.entries.edit : he.entries.add;

  return (
    <>
      <button
        type="button"
        className={compact ? "grid size-11 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]" : "button-primary"}
        onClick={() => { setMessage(""); dialog.current?.showModal(); }}
        aria-label={compact ? (ariaLabel ?? triggerLabel) : undefined}
      >
        {entry ? <Pencil aria-hidden size={compact ? 17 : 20} /> : <Plus aria-hidden size={compact ? 17 : 20} />}
        {!compact && triggerLabel}
      </button>
      <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[28px] border-0 bg-white p-0 shadow-2xl backdrop:bg-black/50">
        <form action={submit} className="grid gap-5 p-5 sm:p-7">
          <header className="flex items-center justify-between gap-3">
            <div><h2 className="text-2xl font-extrabold">{triggerLabel}</h2><p className="muted text-sm">{he.entries.timezoneHint}</p></div>
            <button type="button" aria-label={he.entries.closeDialog} className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--background)]" onClick={() => dialog.current?.close()}><X aria-hidden /></button>
          </header>
          {entry && <input type="hidden" name="id" value={entry.id} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={he.entries.clockIn} name="clockInLocal" type="datetime-local" defaultValue={defaultStart} required />
            <Field label={he.entries.clockOut} name="clockOutLocal" type="datetime-local" defaultValue={defaultEnd} required />
          </div>
          <label className="field">
            <span>{he.entries.category}</span>
            <select className="input" name="categoryId" defaultValue={entry?.categoryId ?? ""}>
              <option value="">{he.entries.noCategory}</option>
              {categories.filter((category) => category.isActive || category.id === entry?.categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? "" : " · " + he.categories.archived}</option>)}
            </select>
          </label>
          <Field label={he.entries.note + " (" + he.entries.optional + ")"} name="note" defaultValue={entry?.note ?? ""} />
          <Field label={he.entries.reason} name="reason" required />
          {message && <p role="status" className="rounded-xl bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{message}</p>}
          <div className="flex gap-3">
            <button className="button-primary flex-1" disabled={pending}>{pending ? he.entries.saving : he.common.save}</button>
            <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>{he.common.cancel}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  const id = String(inputProps.name) + "-" + useId();
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" {...inputProps} /></div>;
}
