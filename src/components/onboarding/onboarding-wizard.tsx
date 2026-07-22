"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, ChevronLeft, ChevronRight, Coins, UserRound } from "lucide-react";
import { completeOnboarding, type OnboardingState } from "@/actions/onboarding-actions";
import { emitDebugEvent } from "@/lib/debug/client";
import { he } from "@/lib/i18n/he";
import { minutesBetween } from "@/lib/time/calculations";

const steps = [he.onboarding.profile, he.onboarding.schedule, he.onboarding.compensation, he.onboarding.leave, he.onboarding.review];
const initialActionState: OnboardingState = { events: [] };
const compensationLabels = {
  hidden: "לא להציג שכר",
  hourly: "שכר שעתי",
  global: "שכר גלובלי",
} as const;

export function OnboardingWizard({ initialUsername }: { initialUsername: string }) {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialActionState);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<keyof typeof compensationLabels>("hidden");
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("17:00");
  const [vacationBalance, setVacationBalance] = useState("0");
  const [sickBalance, setSickBalance] = useState("0");
  const [notifications, setNotifications] = useState(false);
  const [clockInReminder, setClockInReminder] = useState("08:25");
  const [clockOutReminder, setClockOutReminder] = useState("17:05");
  const [reviewReady, setReviewReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const reviewTimerRef = useRef<number | undefined>(undefined);
  const targetMinutes = minutesBetween(startTime, endTime);
  const finalStep = steps.length - 1;

  useEffect(() => {
    for (const event of state.events) {
      emitDebugEvent({ scope: he.debug.onboarding, status: event.status, message: event.message });
    }
  }, [state.events]);

  useEffect(() => () => {
    if (reviewTimerRef.current) window.clearTimeout(reviewTimerRef.current);
  }, []);

  function currentStepIsValid() {
    const controls = formRef.current?.querySelectorAll<HTMLElement>(`[data-step="${step}"] input, [data-step="${step}"] select`);
    for (const control of controls ?? []) {
      if ("reportValidity" in control && typeof control.reportValidity === "function" && !control.reportValidity()) return false;
    }
    return true;
  }

  function advance() {
    if (!currentStepIsValid()) return;
    const next = Math.min(step + 1, finalStep);
    if (next === finalStep) {
      setReviewReady(false);
      if (reviewTimerRef.current) window.clearTimeout(reviewTimerRef.current);
      reviewTimerRef.current = window.setTimeout(() => setReviewReady(true), 700);
    }
    setStep(next);
  }

  function goBack() {
    setReviewReady(false);
    if (reviewTimerRef.current) window.clearTimeout(reviewTimerRef.current);
    setStep((current) => current - 1);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-5"
      onSubmit={(event) => {
        if (step < finalStep) {
          event.preventDefault();
          advance();
        } else if (!reviewReady || pending) {
          event.preventDefault();
        }
      }}
    >
      <ol className="flex gap-2" aria-label="שלבי ההגדרה">
        {steps.map((label, index) => (
          <li key={label} className={`h-2 flex-1 rounded-full ${index <= step ? "bg-[var(--primary)]" : "bg-[var(--surface-muted)]"}`}>
            <span className="sr-only">{label}{index === step ? " – השלב הנוכחי" : ""}</span>
          </li>
        ))}
      </ol>

      <p className="muted text-sm" aria-live="polite">{he.onboarding.progress} {step + 1} {he.onboarding.of} {steps.length}: {steps[step]}</p>

      <div className="min-h-[350px]">
        <div data-step="0" hidden={step !== 0}>
          <Step title="נעים להכיר" subtitle="הפרטים שיעזרו לנו להתאים את ClockIn אליך" icon={UserRound}>
            <Field label="שם משתמש" name="username" defaultValue={initialUsername} required />
            <Field label="שם מלא (לא חובה)" name="fullName" autoComplete="name" />
            <input type="hidden" name="timezone" value="Asia/Jerusalem" />
            <div className="rounded-2xl bg-[var(--background)] p-4"><span className="muted text-sm">אזור זמן קבוע</span><b className="block">ישראל · Asia/Jerusalem</b></div>
          </Step>
        </div>

        <div data-step="1" hidden={step !== 1}>
          <Step title="מתי עובדים?" subtitle="אפשר לשנות כל יום בנפרד בהגדרות" icon={BriefcaseBusiness}>
            <div className="rounded-2xl bg-[var(--primary-soft)] p-4">
              <b>ראשון עד חמישי</b>
              <p className="muted text-sm">שישי ושבת מוגדרים כימי מנוחה</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="שעת התחלה" name="startTime" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
              <Field label="שעת סיום" name="endTime" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
            </div>
            <Field label="יעד יומי בדקות (מחושב אוטומטית)" name="targetMinutes" type="number" inputMode="numeric" value={targetMinutes} readOnly />
          </Step>
        </div>

        <div data-step="2" hidden={step !== 2}>
          <Step title="איך להציג שכר?" subtitle="כל הסכומים מסומנים כהערכה בלבד" icon={Coins}>
            <div className="grid gap-2">
              {(Object.entries(compensationLabels) as Array<[keyof typeof compensationLabels, string]>).map(([value, label]) => (
                <label key={value} className={`flex min-h-14 items-center gap-3 rounded-2xl border p-3 ${mode === value ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border-soft)]"}`}>
                  <input type="radio" name="compensationMode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                  <b>{label}</b>
                </label>
              ))}
            </div>
            {mode === "hourly" && <Field label="תעריף לשעה (₪)" name="hourlyRate" type="number" inputMode="decimal" min="0" step="0.01" required />}
            {mode === "global" && <Field label="שכר חודשי (₪)" name="monthlySalary" type="number" inputMode="decimal" min="0" step="0.01" required />}
          </Step>
        </div>

        <div data-step="3" hidden={step !== 3}>
          <Step title="כמעט סיימנו" subtitle="יתרות פתיחה ותזכורות עדינות" icon={BriefcaseBusiness}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="יתרת חופשה בימים" name="vacationBalance" type="number" inputMode="decimal" min="0" step="0.01" value={vacationBalance} onChange={(event) => setVacationBalance(event.target.value)} required />
              <Field label="יתרת מחלה בימים" name="sickBalance" type="number" inputMode="decimal" min="0" step="0.01" value={sickBalance} onChange={(event) => setSickBalance(event.target.value)} required />
            </div>
            <label className="flex min-h-14 items-center justify-between rounded-2xl bg-[var(--background)] p-4">
              <span><b>הפעלת תזכורות</b><small className="muted block">אפשר לשנות הרשאה בהמשך</small></span>
              <input type="checkbox" name="notifications" className="size-5" checked={notifications} onChange={(event) => setNotifications(event.target.checked)} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="תזכורת כניסה" name="clockInReminder" type="time" value={clockInReminder} onChange={(event) => setClockInReminder(event.target.value)} required />
              <Field label="תזכורת יציאה" name="clockOutReminder" type="time" value={clockOutReminder} onChange={(event) => setClockOutReminder(event.target.value)} required />
            </div>
          </Step>
        </div>

        <div data-step="4" hidden={step !== 4}>
          <Step title={he.onboarding.reviewTitle} subtitle={he.onboarding.reviewSubtitle} icon={CheckCircle2}>
            <dl className="grid gap-3">
              <ReviewRow label={he.onboarding.reviewSchedule} value={`${startTime}–${endTime} · ${targetMinutes} ${he.onboarding.minutesUnit}`} />
              <ReviewRow label={he.onboarding.reviewCompensation} value={compensationLabels[mode]} />
              <ReviewRow label={he.onboarding.reviewBalances} value={`${vacationBalance} ${he.onboarding.vacationDaysUnit} · ${sickBalance} ${he.onboarding.sickDaysUnit}`} />
              <ReviewRow label={he.onboarding.reviewReminders} value={notifications ? `${clockInReminder} / ${clockOutReminder}` : he.onboarding.remindersOff} />
            </dl>
          </Step>
        </div>
      </div>

      {state.error && <p role="alert" className="rounded-2xl bg-[var(--error-soft)] p-4 text-[var(--error)]">{state.error}</p>}

      <div className="flex gap-3">
        {step > 0 && (
          <button type="button" disabled={pending} onClick={goBack} className="button-secondary flex-1">
            <ChevronRight aria-hidden />{he.onboarding.previous}
          </button>
        )}
        {step < finalStep ? (
          <button type="button" disabled={pending} onClick={advance} className="button-primary flex-1">
            {he.onboarding.next}<ChevronLeft aria-hidden />
          </button>
        ) : (
          <button type="submit" disabled={!reviewReady || pending} className="button-primary flex-1">
            {pending ? he.onboarding.saving : he.onboarding.finish}<ChevronLeft aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}

function Step({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof UserRound; children: React.ReactNode }) {
  return <section className="grid gap-5"><div className="pt-2"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon aria-hidden /></span><h2 className="text-2xl font-extrabold">{title}</h2><p className="muted mt-1">{subtitle}</p></div>{children}</section>;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  const id = `field-${rest.name}`;
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" {...rest} /></div>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4"><dt className="muted text-sm">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>;
}
