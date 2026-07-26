"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Clock3, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteEntry, saveEntry } from "@/actions/entry-actions";
import type { EditableEntry, EntryFormCategory } from "@/components/entries/entry-form";
import { he } from "@/lib/i18n/he";
import { formatMinutes } from "@/lib/formatting";

type EditorSelection = {
  entry?: EditableEntry;
  initialDate?: string;
};

type EditorContextValue = {
  open: (selection: EditorSelection) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EntryEditorProvider({
  categories,
  timezone,
  children,
}: {
  categories: EntryFormCategory[];
  timezone: string;
  children: React.ReactNode;
}) {
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (selection && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selection]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <EditorContext.Provider value={{ open: setSelection }}>
      {children}
      {selection && (
        <EntryDialog
          key={selection.entry?.id ?? selection.initialDate}
          dialogRef={dialog}
          categories={categories}
          timezone={timezone}
          selection={selection}
          onClose={() => setSelection(null)}
          onResult={setNotice}
        />
      )}
      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`fixed inset-inline-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl p-4 text-center text-sm font-bold shadow-xl md:bottom-6 ${notice.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--error-soft)] text-[var(--error)]"}`}
        >
          {notice.message}
        </p>
      )}
    </EditorContext.Provider>
  );
}

export function EntryEditorTrigger({
  entry,
  initialDate,
  ariaLabel,
  showLabel = false,
}: EditorSelection & {
  ariaLabel: string;
  showLabel?: boolean;
}) {
  const context = useContext(EditorContext);
  if (!context) throw new Error("entry_editor_provider_missing");
  const label = entry ? he.entries.edit : he.entries.add;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={showLabel ? "button-primary" : "grid size-11 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]"}
      onClick={() => context.open({ entry, initialDate })}
    >
      {entry ? <Pencil aria-hidden size={showLabel ? 20 : 17} /> : <Plus aria-hidden size={showLabel ? 20 : 17} />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
function EntryDialog({
  dialogRef,
  categories,
  timezone,
  selection,
  onClose,
  onResult,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  categories: EntryFormCategory[];
  timezone: string;
  selection: EditorSelection;
  onClose: () => void;
  onResult: (result: { ok: boolean; message: string }) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const [latestLocal, setLatestLocal] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const { entry, initialDate } = selection;
  const defaultStart = entry?.clockInLocal ?? (initialDate ? initialDate + "T09:00" : "");
  const defaultEnd = entry?.clockOutLocal ?? (initialDate ? initialDate + "T17:00" : "");
  const [clockInLocal, setClockInLocal] = useState(defaultStart);
  const [clockOutLocal, setClockOutLocal] = useState(defaultEnd);
  const durationMinutes = clockInLocal && clockOutLocal
    ? Math.round((fromZonedTime(clockOutLocal, timezone).getTime() - fromZonedTime(clockInLocal, timezone).getTime()) / 60_000)
    : null;
  const invalidRange = durationMinutes !== null && durationMinutes <= 0;

  useEffect(() => {
    const update = () => setLatestLocal(formatInTimeZone(new Date(), timezone, "yyyy-MM-dd'T'HH:mm"));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [timezone]);

  function close() {
    dialogRef.current?.close();
  }

  function submit(formData: FormData) {
    const clockIn = String(formData.get("clockInLocal"));
    const clockOut = String(formData.get("clockOutLocal"));
    formData.set("clockIn", fromZonedTime(clockIn, timezone).toISOString());
    formData.set("clockOut", fromZonedTime(clockOut, timezone).toISOString());
    if (!entry) formData.set("reason", he.entries.manual);
    startTransition(async () => {
      const result = await saveEntry(formData);
      setMessage(result.message ?? "");
      onResult({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) close();
    });
  }

  function remove() {
    if (!entry || !form.current) return;
    const reason = String(new FormData(form.current).get("reason") ?? "").trim();
    if (reason.length < 3) {
      setMessage(he.entries.deleteReason);
      return;
    }
    if (!window.confirm(he.entries.deleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteEntry(entry.id, reason);
      setMessage(result.message);
      onResult({ ok: result.ok, message: result.message });
      if (result.ok) close();
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[28px] border-0 bg-white p-0 shadow-2xl backdrop:bg-black/50"
    >
      <form ref={form} action={submit} className="grid gap-5 p-5 sm:p-7">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-2xl font-extrabold">{entry ? he.entries.edit : he.entries.add}</h2>
            <p className="muted text-sm">{he.entries.timezoneHint}</p>
          </div>
          <button type="button" aria-label={he.entries.closeDialog} className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--background)]" onClick={close}>
            <X aria-hidden />
          </button>
        </header>
        {entry && <input type="hidden" name="id" value={entry.id} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={he.entries.clockIn} name="clockInLocal" type="datetime-local" value={clockInLocal} onChange={(event) => setClockInLocal(event.target.value)} max={latestLocal || undefined} required />
          <Field label={he.entries.clockOut} name="clockOutLocal" type="datetime-local" value={clockOutLocal} onChange={(event) => setClockOutLocal(event.target.value)} min={clockInLocal || undefined} max={latestLocal || undefined} aria-invalid={invalidRange || undefined} required />
        </div>
        <p className="muted -mt-3 text-xs">{he.entries.noFuture}</p>
        <div className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 ${invalidRange ? "border-[var(--error)]/30 bg-[var(--error-soft)] text-[var(--error)]" : "border-[var(--border-soft)] bg-[var(--background)]"}`}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[var(--primary)]"><Clock3 aria-hidden size={19} /></span>
          <div><span className="muted block text-xs">{he.entries.calculatedDuration}</span><output className="metric-value mt-0.5 block font-bold" aria-live="polite">{invalidRange ? he.entries.invalidRange : durationMinutes === null ? he.entries.selectTimes : formatMinutes(durationMinutes)}</output></div>
        </div>
        <label className="field">
          <span>{he.entries.category}</span>
          <select className="input" name="categoryId" defaultValue={entry?.categoryId ?? ""}>
            <option value="">{he.entries.noCategory}</option>
            {categories
              .filter((category) => category.isActive || category.id === entry?.categoryId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}{category.isActive ? "" : " · " + he.categories.archived}
                </option>
              ))}
          </select>
        </label>
        <Field label={he.entries.note + " (" + he.entries.optional + ")"} name="note" defaultValue={entry?.note ?? ""} />
        {entry && <Field label={he.entries.editReason} name="reason" required />}
        {message && <p role="alert" className="rounded-xl bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{message}</p>}
        <div className="flex flex-wrap gap-3">
          <button className="button-primary flex-1" disabled={pending || invalidRange}>{pending ? he.entries.saving : he.common.save}</button>
          <button type="button" className="button-secondary" disabled={pending} onClick={close}>{he.common.cancel}</button>
          {entry && (
            <button type="button" className="button-danger" disabled={pending} onClick={remove}>
              <Trash2 aria-hidden size={18} />{he.entries.delete}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  const id = String(inputProps.name) + "-" + useId();
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" {...inputProps} /></div>;
}
