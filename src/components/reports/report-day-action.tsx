"use client";

import { createContext, useContext, useId, useRef, useState, useTransition } from "react";
import { CalendarDays, Palmtree, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cancelReportVacation, saveReportVacation } from "@/actions/report-leave-actions";
import { EntryEditorTrigger } from "@/components/entries/entry-editor";
import { formatMinutes } from "@/lib/formatting";
import { he } from "@/lib/i18n/he";

export type ReportVacation = {
  id: string;
  startDate: string;
  endDate: string;
  partialMinutes: number | null;
  note: string | null;
};

type DaySelection = {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  allowTimeEntry: boolean;
  vacation?: ReportVacation;
  hasOtherLeave: boolean;
};

type DayActionContextValue = { open: (selection: DaySelection) => void };
const DayActionContext = createContext<DayActionContextValue | null>(null);

export function ReportDayActionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<DaySelection | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const chooser = useRef<HTMLDialogElement>(null);
  const vacationDialog = useRef<HTMLDialogElement>(null);

  function open(nextSelection: DaySelection) {
    setSelection(nextSelection);
    window.requestAnimationFrame(() => chooser.current?.showModal());
  }

  return (
    <DayActionContext.Provider value={{ open }}>
      {children}
      {selection && (
        <DayActionDialogs
          key={`${selection.date}-${selection.vacation?.id ?? "new"}`}
          chooserRef={chooser}
          vacationDialogRef={vacationDialog}
          selection={selection}
          onClose={() => setSelection(null)}
          onResult={setNotice}
        />
      )}
      {notice && <p role={notice.ok ? "status" : "alert"} className={`fixed inset-inline-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl p-4 text-center text-sm font-bold shadow-xl md:bottom-6 ${notice.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--error-soft)] text-[var(--error)]"}`}>{notice.message}</p>}
    </DayActionContext.Provider>
  );
}

export function ReportDayAction(props: DaySelection) {
  const context = useContext(DayActionContext);
  if (!context) throw new Error("report_day_action_provider_missing");
  return (
    <button type="button" aria-label={`${props.vacation ? he.report.editDayAction : he.report.addDayAction} ${props.date}`} className="grid size-11 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]" onClick={() => context.open(props)}>
      {props.vacation ? <Pencil aria-hidden size={17} /> : <Plus aria-hidden size={17} />}
    </button>
  );
}

function DayActionDialogs({ chooserRef, vacationDialogRef, selection, onClose, onResult }: {
  chooserRef: React.RefObject<HTMLDialogElement | null>;
  vacationDialogRef: React.RefObject<HTMLDialogElement | null>;
  selection: DaySelection;
  onClose: () => void;
  onResult: (result: { ok: boolean; message: string } | null) => void;
}) {
  const router = useRouter();
  const chooserTitleId = useId();
  const vacationTitleId = useId();
  const [duration, setDuration] = useState<"full" | "partial">(selection.vacation?.partialMinutes == null ? "full" : "partial");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const formattedDate = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(selection.date + "T12:00:00Z"));
  const noWorkTarget = selection.expectedMinutes <= 0;

  function close(dialog: React.RefObject<HTMLDialogElement | null>) {
    dialog.current?.close();
    onClose();
  }

  function openVacation() {
    chooserRef.current?.close();
    setMessage("");
    window.requestAnimationFrame(() => vacationDialogRef.current?.showModal());
  }

  function showResult(result: { ok: boolean; message: string }) {
    onResult(result);
    window.setTimeout(() => onResult(null), 4_000);
  }

  function submitVacation(formData: FormData) {
    startTransition(async () => {
      const result = await saveReportVacation(formData);
      setMessage(result.ok ? "" : result.message);
      showResult(result);
      if (result.ok) {
        vacationDialogRef.current?.close();
        onClose();
        router.refresh();
      }
    });
  }

  function cancelVacation() {
    if (!selection.vacation || !window.confirm(he.report.vacationCancelConfirm)) return;
    startTransition(async () => {
      const result = await cancelReportVacation(selection.vacation!.id);
      setMessage(result.ok ? "" : result.message);
      showResult(result);
      if (result.ok) {
        vacationDialogRef.current?.close();
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <>
      <dialog ref={chooserRef} aria-labelledby={chooserTitleId} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[28px] border-0 bg-white p-0 shadow-2xl backdrop:bg-black/50">
        <div className="grid gap-5 p-5 sm:p-7">
          <header className="flex items-center justify-between gap-3">
            <div><h2 id={chooserTitleId} className="text-2xl font-extrabold">{he.report.chooseDayAction}</h2><p className="muted mt-1 text-sm">{formattedDate}</p></div>
            <button type="button" aria-label={he.common.close} className="grid size-11 place-items-center rounded-full bg-[var(--background)]" onClick={() => close(chooserRef)}><X aria-hidden /></button>
          </header>
          <div className="grid gap-3">
            <EntryEditorTrigger ariaLabel={`${he.report.addWorkReport} ${selection.date}`} initialDate={selection.date} showLabel labelOverride={he.report.addWorkReport} disabled={!selection.allowTimeEntry} onBeforeOpen={() => { chooserRef.current?.close(); onClose(); }} />
            {!selection.allowTimeEntry && <p className="muted -mt-1 text-xs">{he.report.futureWorkBlocked}</p>}
            <button type="button" className="button-secondary w-full" disabled={(noWorkTarget && !selection.vacation) || selection.hasOtherLeave} onClick={openVacation}><Palmtree aria-hidden size={20} />{selection.vacation ? he.report.editVacationDay : he.report.addVacationDay}</button>
            {noWorkTarget && !selection.vacation && <p className="muted -mt-1 text-xs">{he.report.noVacationNeeded}</p>}
            {selection.hasOtherLeave && <p className="muted -mt-1 text-xs">{he.report.otherLeaveExists}</p>}
          </div>
        </div>
      </dialog>

      <dialog ref={vacationDialogRef} aria-labelledby={vacationTitleId} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[28px] border-0 bg-white p-0 shadow-2xl backdrop:bg-black/50">
        <form action={submitVacation} className="grid gap-5 p-5 sm:p-7">
          <header className="flex items-center justify-between gap-3">
            <div><h2 id={vacationTitleId} className="text-2xl font-extrabold">{selection.vacation ? he.report.editVacationDay : he.report.addVacationDay}</h2><p className="muted mt-1 text-sm">{formattedDate}</p></div>
            <button type="button" aria-label={he.common.close} className="grid size-11 place-items-center rounded-full bg-[var(--background)]" onClick={() => close(vacationDialogRef)}><X aria-hidden /></button>
          </header>
          <input type="hidden" name="id" value={selection.vacation?.id ?? ""} />
          <input type="hidden" name="date" value={selection.date} />
          <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--background)] p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[var(--vacation)]"><CalendarDays aria-hidden size={19} /></span>
            <div><span className="muted block text-xs">{he.report.dailyStandard}</span><strong className="metric-value mt-0.5 block">{formatMinutes(selection.expectedMinutes)}</strong></div>
          </div>
          {selection.workedMinutes > 0 && <div className="flex gap-3 rounded-2xl bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]"><TriangleAlert aria-hidden className="shrink-0" size={20} /><span>{he.report.vacationWithWorkWarning}</span></div>}
          {selection.vacation && selection.vacation.startDate !== selection.vacation.endDate && <div className="rounded-2xl bg-[var(--primary-soft)] p-3 text-sm text-[var(--primary)]">{he.report.vacationRangeNotice} <bdi dir="ltr">{selection.vacation.startDate}–{selection.vacation.endDate}</bdi></div>}
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-bold">{he.report.vacationDuration}</legend>
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--border-soft)] px-4"><input type="radio" name="duration" value="full" checked={duration === "full"} onChange={() => setDuration("full")} />{he.report.fullVacationDay}</label>
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--border-soft)] px-4"><input type="radio" name="duration" value="partial" checked={duration === "partial"} onChange={() => setDuration("partial")} />{he.report.partialVacationDay}</label>
          </fieldset>
          {duration === "partial" && <label className="field"><span>{he.report.partialVacationHours}</span><input className="input" name="partialHours" type="number" inputMode="decimal" min="0.25" max={Math.max(0.25, selection.expectedMinutes / 60)} step="0.25" defaultValue={selection.vacation?.partialMinutes ? selection.vacation.partialMinutes / 60 : ""} required /></label>}
          <label className="field"><span>{he.entries.note} ({he.entries.optional})</span><input className="input" name="note" defaultValue={selection.vacation?.note ?? ""} maxLength={500} /></label>
          {message && <p role="alert" className="rounded-xl bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{message}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="button-primary flex-1" disabled={pending}>{pending ? he.entries.saving : he.report.saveVacationDay}</button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => close(vacationDialogRef)}>{he.common.cancel}</button>
            {selection.vacation && <button type="button" className="button-danger" disabled={pending} onClick={cancelVacation}><Trash2 aria-hidden size={18} />{he.report.cancelVacationDay}</button>}
          </div>
        </form>
      </dialog>
    </>
  );
}