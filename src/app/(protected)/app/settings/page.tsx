import { formatInTimeZone } from "date-fns-tz";
import { Accessibility, Bell, BriefcaseBusiness, CalendarHeart, CalendarRange, Coins, LogOut, Trash2, UserRound } from "lucide-react";
import { logoutAction } from "@/actions/auth-actions";
import { addException, addLeave, createSchedule, deleteException, deleteLeave, saveCompensation, saveProfile, saveReminders } from "@/actions/settings-actions";
import { AccessibilitySettings } from "@/components/settings/accessibility-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { SettingsSubmitButton } from "@/components/settings/settings-submit-button";
import { WorkCategoriesSettings } from "@/components/settings/work-categories-settings";
import { createClient } from "@/lib/supabase/server";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";
import { requireUser } from "@/lib/supabase/session";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { isDemoMode } from "@/lib/demo";

const feedback: Record<string, { ok: boolean; text: string }> = {
  profile_saved: { ok: true, text: "הפרופיל נשמר" }, profile_invalid: { ok: false, text: "פרטי הפרופיל אינם תקינים" }, profile_error: { ok: false, text: "לא ניתן לשמור את הפרופיל" }, username_taken: { ok: false, text: "שם המשתמש כבר תפוס" },
  schedule_saved: { ok: true, text: "שגרת העבודה נשמרה" }, schedule_invalid: { ok: false, text: "יש לבדוק את ימי ושעות העבודה" }, schedule_error: { ok: false, text: "לא ניתן לשמור את שגרת העבודה" },
  compensation_saved: { ok: true, text: "הגדרת השכר נשמרה" }, compensation_invalid: { ok: false, text: "יש לבדוק את פרטי השכר" }, compensation_error: { ok: false, text: "לא ניתן לשמור את הגדרת השכר" },
  leave_saved: { ok: true, text: "ההיעדרות נשמרה" }, leave_deleted: { ok: true, text: "ההיעדרות בוטלה" }, leave_invalid: { ok: false, text: "פרטי ההיעדרות אינם תקינים" }, leave_overlap: { ok: false, text: "כבר קיימת היעדרות מאושרת בחלק מהתאריכים האלה" }, leave_error: { ok: false, text: "לא ניתן לעדכן את ההיעדרות" },
  exception_saved: { ok: true, text: "היום המיוחד נשמר" }, exception_deleted: { ok: true, text: "היום המיוחד נמחק" }, exception_invalid: { ok: false, text: "פרטי היום המיוחד אינם תקינים" }, exception_error: { ok: false, text: "לא ניתן לעדכן את היום המיוחד" },
  reminders_saved: { ok: true, text: "התזכורות נשמרו" }, reminders_invalid: { ok: false, text: "שעות התזכורת אינן תקינות" }, reminders_error: { ok: false, text: "לא ניתן לשמור את התזכורות" },
};

type CategoryRow = { id: string; name: string; is_active: boolean };
type ScheduleDayRow = { weekday: number; is_workday: boolean; expected_start_time: string | null; expected_end_time: string | null; target_minutes: number };
type ScheduleRow = { id: string; name: string; effective_from: string; work_schedule_days: ScheduleDayRow[] };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ newCategory?: string; result?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const today = formatInTimeZone(new Date(), "Asia/Jerusalem", "yyyy-MM-dd");
  let profile: { username: string; full_name: string | null } | null;
  let reminders: Array<{ reminder_type: string; enabled: boolean; local_time: string }> | null;
  let terms: { mode: string; hourly_rate: number | null; monthly_salary: number | null; effective_from: string } | null;
  let leaves: Array<{ id: string; leave_type: string; start_date: string; end_date: string }> | null;
  let exceptions: Array<{ id: string; exception_date: string; name: string; exception_type: string; target_minutes: number | null }> | null;
  let categories: CategoryRow[];
  let schedule: ScheduleRow | null;

  if (isDemoMode()) {
    profile = { username: "נועה לדוגמה", full_name: "נועה ישראלי" };
    reminders = [{ reminder_type: "clock_in", enabled: true, local_time: "08:25" }, { reminder_type: "clock_out", enabled: true, local_time: "17:05" }];
    terms = { mode: "hourly", hourly_rate: 62.5, monthly_salary: null, effective_from: today };
    leaves = [];
    exceptions = [];
    categories = [];
    schedule = { id: "demo", name: "שגרת עבודה", effective_from: today, work_schedule_days: Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_workday: weekday <= 4, expected_start_time: weekday <= 4 ? "08:30:00" : null, expected_end_time: weekday <= 4 ? "17:00:00" : null, target_minutes: weekday <= 4 ? 510 : 0 })) };
  } else {
    const [cachedProfile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
    const results = await Promise.all([
      supabase.from("reminder_settings").select("reminder_type,enabled,local_time"),
      supabase.from("employment_terms").select("mode,hourly_rate,monthly_salary,effective_from").order("effective_from", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("leave_entries").select("id,leave_type,start_date,end_date").eq("status", "approved").order("start_date", { ascending: false }).limit(5),
      supabase.from("calendar_exceptions").select("id,exception_date,exception_type,name,target_minutes").order("exception_date", { ascending: false }).limit(8),
      supabase.from("work_categories").select("id,name,is_active").order("sort_order").order("created_at"),
      supabase.from("work_schedule_versions").select("id,name,effective_from,work_schedule_days(weekday,is_workday,expected_start_time,expected_end_time,target_minutes)").order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    ]);
    requireSuccessfulQueries("settings", results);
    profile = cachedProfile;
    reminders = results[0].data;
    terms = results[1].data;
    leaves = results[2].data;
    exceptions = results[3].data;
    categories = results[4].data ?? [];
    schedule = results[5].data as ScheduleRow | null;
  }

  const reminder = (type: string) => reminders?.find((row) => row.reminder_type === type);
  const activeDays = schedule?.work_schedule_days.filter((day) => day.is_workday).sort((a, b) => a.weekday - b.weekday) ?? [];
  const firstDay = activeDays[0];
  const scheduleDescription = activeDays.length ? activeDays.map((day) => ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"][day.weekday]).join(", ") + " · " + firstDay.expected_start_time?.slice(0, 5) + "–" + firstDay.expected_end_time?.slice(0, 5) : "לא הוגדרה שגרת עבודה";
  const notice = params.result ? feedback[params.result] : undefined;

  return <div className="grid gap-6">
    <header><p className="muted text-sm">הכול בשליטה, במקום אחד</p><h1 className="text-3xl font-extrabold">הגדרות</h1></header>
    {notice && <div role={notice.ok ? "status" : "alert"} className={"rounded-2xl p-4 font-bold " + (notice.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--error-soft)] text-[var(--error)]")}>{notice.text}</div>}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SettingsCard icon={UserRound} title="פרופיל" description="הפרטים האישיים שלך">
        <form action={saveProfile} className="grid gap-3">
          <Field label="שם משתמש" name="username" defaultValue={profile?.username} required />
          <Field label="שם מלא" name="fullName" defaultValue={profile?.full_name ?? ""} />
          <div className="rounded-2xl bg-[var(--background)] p-4 text-sm"><span className="muted">אזור זמן</span><b className="block">ישראל · Asia/Jerusalem</b></div>
          <div className="muted text-sm">דואר אלקטרוני: <b dir="ltr">{user.email}</b></div>
          <SettingsSubmitButton>שמירת שינויים</SettingsSubmitButton>
        </form>
      </SettingsCard>

      <SettingsCard icon={BriefcaseBusiness} title="שעות עבודה" description={scheduleDescription}>
        <div className="grid grid-cols-7 gap-2 text-center">{["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((day, weekday) => <span key={day} className={"rounded-xl p-3 font-bold " + (activeDays.some((item) => item.weekday === weekday) ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--background)] muted")}>{day}</span>)}</div>
        <p className="muted text-sm">שינוי שגרה יוצר גרסה חדשה מתאריך התחולה ושומר על דוחות היסטוריים.</p>
        <details className="rounded-2xl border border-[var(--border-soft)] p-4">
          <summary className="cursor-pointer font-bold text-[var(--primary)]">יצירת שגרה חדשה</summary>
          <form action={createSchedule} className="mt-4 grid gap-3">
            <Field id="schedule-name" label="שם השגרה" name="name" defaultValue={schedule?.name ?? "שגרת עבודה"} required />
            <Field id="schedule-effective-from" label="בתוקף מתאריך" name="effectiveFrom" type="date" defaultValue={today} required />
            <div className="grid gap-3 sm:grid-cols-2"><Field label="שעת התחלה" name="startTime" type="time" defaultValue={firstDay?.expected_start_time?.slice(0, 5) ?? "08:30"} required /><Field label="שעת סיום" name="endTime" type="time" defaultValue={firstDay?.expected_end_time?.slice(0, 5) ?? "17:00"} required /></div>
            <fieldset><legend className="mb-2 font-bold">ימי עבודה</legend><div className="grid grid-cols-7 gap-2">{["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((day, weekday) => <label key={day} className="grid min-h-14 place-items-center rounded-xl bg-[var(--background)]"><span>{day}</span><input type="checkbox" name="workdays" value={weekday} defaultChecked={activeDays.length ? activeDays.some((item) => item.weekday === weekday) : weekday <= 4} /></label>)}</div></fieldset>
            <SettingsSubmitButton>שמירת שגרה חדשה</SettingsSubmitButton>
          </form>
        </details>
        <WorkCategoriesSettings categories={categories} autoOpen={params.newCategory === "1"} />
      </SettingsCard>

      <SettingsCard icon={Coins} title="שכר" description="כל החישובים הם הערכה בלבד">
        <div className="rounded-2xl bg-[var(--background)] p-4"><p className="muted text-sm">מצב נוכחי</p><b>{terms?.mode === "hourly" ? "שכר שעתי · ₪" + terms.hourly_rate : terms?.mode === "global" ? "שכר חודשי · ₪" + terms.monthly_salary : "הצגת שכר כבויה"}</b></div>
        <details className="rounded-2xl border border-[var(--border-soft)] p-4"><summary className="cursor-pointer font-bold text-[var(--primary)]">הוספת תנאי שכר מתאריך</summary><form action={saveCompensation} className="mt-4 grid gap-3">
          <Field id="compensation-effective-from" label="בתוקף מתאריך" name="effectiveFrom" type="date" defaultValue={today} required />
          <label className="field"><span>אופן הצגה</span><select className="input" name="mode" defaultValue={terms?.mode ?? "hidden"}><option value="hidden">ללא הצגת שכר</option><option value="hourly">שכר שעתי</option><option value="global">שכר חודשי</option></select></label>
          <Field label="תעריף לשעה (₪)" name="hourlyRate" type="number" min="0" step="0.01" defaultValue={terms?.hourly_rate ?? ""} />
          <Field label="שכר חודשי (₪)" name="monthlySalary" type="number" min="0" step="0.01" defaultValue={terms?.monthly_salary ?? ""} />
          <SettingsSubmitButton>שמירת תנאי שכר</SettingsSubmitButton>
        </form></details>
      </SettingsCard>

      <SettingsCard icon={CalendarHeart} title="חופשה ומחלה" description="דיווחים מלאים או חלקיים">
        <form action={addLeave} className="grid gap-3"><label className="field"><span>סוג היעדרות</span><select className="input" name="leaveType"><option value="vacation">חופשה</option><option value="sick">מחלה</option></select></label><div className="grid gap-3 sm:grid-cols-2"><Field label="מתאריך" name="startDate" type="date" required /><Field label="עד תאריך" name="endDate" type="date" required /></div><Field label="דקות ליום חלקי" name="partialMinutes" type="number" min="1" max="1440" /><Field id="leave-note" label="הערה" name="note" /><SettingsSubmitButton>הוספת היעדרות</SettingsSubmitButton></form>
        {leaves?.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--background)] p-3 text-sm"><p><b>{row.leave_type === "vacation" ? "חופשה" : "מחלה"}</b> · <span dir="ltr">{row.start_date}–{row.end_date}</span></p><form action={deleteLeave}><input type="hidden" name="id" value={row.id} /><SettingsSubmitButton className="grid size-11 place-items-center rounded-full text-[var(--error)]" ><Trash2 aria-hidden size={17} /><span className="sr-only">ביטול היעדרות</span></SettingsSubmitButton></form></div>)}
      </SettingsCard>

      <SettingsCard icon={CalendarRange} title="חגי ישראל וימים מיוחדים" description="חגים מתעדכנים אוטומטית; אפשר להוסיף חריג אישי">
        <div className="rounded-2xl bg-[var(--primary-soft)] p-4 text-sm text-[var(--primary)]"><b>סנכרון אוטומטי פעיל</b><p>תאריכי חגי ישראל מגיעים מ־Hebcal. ימי חג מסומנים כחופש וערבי חג מקוצרים לפי ברירת המחדל החוקית למקום עבודה של 5 ימים. הסכם עבודה מיטיב גובר.</p></div>
        <form action={addException} className="grid gap-3"><Field label="תאריך" name="date" type="date" required /><label className="field"><span>סוג יום</span><select className="input" name="type"><option value="holiday">יום חג / חופש</option><option value="shortened">יום מקוצר</option><option value="day_off">יום חופשי נוסף</option><option value="special_workday">יום עבודה מיוחד</option></select></label><Field id="exception-name" label="שם היום" name="name" required /><Field label="יעד בדקות ליום מקוצר או מיוחד" name="targetMinutes" type="number" min="0" max="1440" /><Field id="exception-note" label="הערה" name="note" /><SettingsSubmitButton>שמירת יום מיוחד</SettingsSubmitButton></form>
        {exceptions?.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--background)] p-3 text-sm"><p><b>{row.name}</b> · <span dir="ltr">{row.exception_date}</span>{row.target_minutes != null ? " · " + row.target_minutes + " דקות" : ""}</p><form action={deleteException}><input type="hidden" name="id" value={row.id} /><SettingsSubmitButton className="grid size-11 place-items-center rounded-full text-[var(--error)]"><Trash2 aria-hidden size={17} /><span className="sr-only">מחיקת יום מיוחד</span></SettingsSubmitButton></form></div>)}
      </SettingsCard>

      <SettingsCard icon={Bell} title="תזכורות" description="תזכורות לפי שעון ישראל">
        <form action={saveReminders} className="grid gap-3"><Toggle label="תזכורת כניסה" name="clockInEnabled" defaultChecked={reminder("clock_in")?.enabled} /><Field label="שעת תזכורת כניסה" name="clockInTime" type="time" defaultValue={reminder("clock_in")?.local_time?.slice(0, 5) ?? "08:25"} required /><Toggle label="תזכורת יציאה" name="clockOutEnabled" defaultChecked={reminder("clock_out")?.enabled} /><Field label="שעת תזכורת יציאה" name="clockOutTime" type="time" defaultValue={reminder("clock_out")?.local_time?.slice(0, 5) ?? "17:05"} required /><SettingsSubmitButton>שמירת תזכורות</SettingsSubmitButton></form><NotificationSettings />
      </SettingsCard>

      <SettingsCard icon={Accessibility} title="נגישות" description="העדפות תצוגה שפועלות מיד"><AccessibilitySettings /></SettingsCard>
    </div>
    <form action={logoutAction}><SettingsSubmitButton className="button-danger"><LogOut aria-hidden />יציאה מהחשבון</SettingsSubmitButton></form>
  </div>;
}

function SettingsCard({ icon: Icon, title, description, children }: { icon: typeof UserRound; title: string; description: string; children: React.ReactNode }) { return <section className="card grid gap-4 p-5"><header className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon aria-hidden /></span><div><h2 className="text-xl font-extrabold">{title}</h2><p className="muted text-sm">{description}</p></div></header>{children}</section>; }
function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { const { label, id: providedId, ...rest } = props; const id = providedId ?? "settings-" + rest.name; return <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" {...rest} /></div>; }
function Toggle({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="flex min-h-14 items-center justify-between rounded-2xl bg-[var(--background)] p-4"><b>{label}</b><input type="checkbox" className="size-5 accent-[var(--primary)]" {...props} /></label>; }