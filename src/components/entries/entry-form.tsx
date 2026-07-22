"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { deleteEntry, saveEntry } from "@/actions/entry-actions";
import { he } from "@/lib/i18n/he";

export type EntryFormCategory = { id: string; name: string; isActive: boolean };
export type EditableEntry = {
  id: string;
  clockInLocal: string;
  clockOutLocal: string;
  categoryId: string | null;
  note?: string | null;
};

export function EntryForm({ categories, entry, initialDate, compact = false, ariaLabel, timezone = "Asia/Jerusalem" }: {
  categories: EntryFormCategory[];
  entry?: EditableEntry;
  initialDate?: string;
  compact?: boolean;
  ariaLabel?: string;
  timezone?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [latestLocal, setLatestLocal] = useState("");
  const defaultStart = entry?.clockInLocal ?? (initialDate ? initialDate + "T09:00" : "");
  const defaultEnd = entry?.clockOutLocal ?? (initialDate ? initialDate + "T17:00" : "");

  useEffect(() => {
    const update = () => setLatestLocal(formatInTimeZone(new Date(), timezone, "yyyy-MM-dd'T'HH:mm"));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [timezone]);

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

  function remove() {
    if (!entry || !form.current) return;
    const reason = String(new FormData(form.current).get("reason") ?? "").trim();
    if (reason.length < 3) { setMessage(he.entries.deleteReason); return; }
    if (!window.confirm(he.entries.deleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteEntry(entry.id, reason);
      setMessage(result.message);
      if (result.ok) dialog.current?.close();
    });
  }

  const triggerLabel = entry ? he.entries.edit : he.entries.add;

  return (
    <>
      <button type="button" className={compact ? "grid size-11 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]" : "button-primary"} onClick={() => { setMessage(""); dialog.current?.showModal(); }} aria-label={compact ? (ariaLabel ?? triggerLabel) : undefined}>
        {entry ? <Pencil aria-hidden size={compact ? 17 : 20} /> : <Plus aria-hidden size={compact ? 17 : 20} />}
        {!compact && triggerLabel}
      </button>
      <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[28px] border-0 bg-white p-0 shadow-2xl backdrop:bg-black/50">
        <form ref={form} action={submit} className="grid gap-5 p-5 sm:p-7">
          <header className="flex items-center justify-between gap-3">
            <div><h2 className="text-2xl font-extrabold">{triggerLabel}</h2><p className="muted text-sm">{he.entries.timezoneHint}</p></div>
            <button type="button" aria-label={he.entries.closeDialog} className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--background)]" onClick={() => dialog.current?.close()}><X aria-hidden /></button>
          </header>
          {entry && <input type="hidden" name="id" value={entry.id} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={he.entries.clockIn} name="clockInLocal" type="datetime-local" defaultValue={defaultStart} max={latestLocal || undefined} required />
            <Field label={he.entries.clockOut} name="clockOutLocal" type="datetime-local" defaultValue={defaultEnd} max={latestLocal || undefined} required />
          </div>
          <p className="muted -mt-3 text-xs">{he.entries.noFuture}</p>
          <label className="field">
            <span>{he.entries.category}</span>
            <select className="input" name="categoryId" defaultValue={entry?.categoryId ?? ""}>
              <option value="">{he.entries.noCategory}</option>
              {categories.filter((category) => category.isActive || category.id === entry?.categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? "" : " · " + he.categories.archived}</option>)}
            </select>
          </label>
          <Field label={he.entries.note + " (" + he.entries.optional + ")"} name="note" defaultValue={entry?.note ?? ""} />
          <Field label={entry ? he.entries.editReason : he.entries.reason} name="reason" required />
          {message && <p role="alert" className="rounded-xl bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{message}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="button-primary flex-1" disabled={pending}>{pending ? he.entries.saving : he.common.save}</button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => dialog.current?.close()}>{he.common.cancel}</button>
            {entry && <button type="button" className="button-danger" disabled={pending} onClick={remove}><Trash2 aria-hidden size={18} />{he.entries.delete}</button>}
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