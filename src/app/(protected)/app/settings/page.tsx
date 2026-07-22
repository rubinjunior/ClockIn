import { Accessibility, Bell, BriefcaseBusiness, CalendarHeart, CalendarRange, Coins, LogOut, UserRound } from "lucide-react";
import { logoutAction } from "@/actions/auth-actions";
import { addException, addLeave, saveProfile, saveReminders } from "@/actions/settings-actions";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { WorkCategoriesSettings } from "@/components/settings/work-categories-settings";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/session";
import { isDemoMode } from "@/lib/demo";

type CategoryRow = { id: string; name: string; is_active: boolean };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ newCategory?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  let profile: { username: string; full_name: string | null; timezone: string } | null;
  let reminders: Array<{ reminder_type: string; enabled: boolean; local_time: string }> | null;
  let terms: { mode: string; hourly_rate: number | null; monthly_salary: number | null } | null;
  let leaves: Array<{ id: string; leave_type: string; start_date: string }> | null;
  let exceptions: Array<{ id: string; exception_date: string; name: string }> | null;
  let categories: CategoryRow[];

  if (isDemoMode()) {
    profile = { username: "נועה לדוגמה", full_name: "נועה ישראלי", timezone: "Asia/Jerusalem" };
    reminders = [{ reminder_type: "clock_in", enabled: true, local_time: "08:25" }, { reminder_type: "clock_out", enabled: true, local_time: "17:05" }];
    terms = { mode: "hourly", hourly_rate: 62.5, monthly_salary: null };
    leaves = [];
    exceptions = [];
    categories = [];
  } else {
    const supabase = await createClient();
    const results = await Promise.all([
      supabase.from("profiles").select("username,full_name,timezone").eq("id", user.id).single(),
      supabase.from("reminder_settings").select("reminder_type,enabled,local_time"),
      supabase.from("employment_terms").select("mode,hourly_rate,monthly_salary,currency,effective_from").order("effective_from", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("leave_entries").select("id,leave_type,start_date,end_date,status").order("start_date", { ascending: false }).limit(3),
      supabase.from("calendar_exceptions").select("id,exception_date,exception_type,name,target_minutes").order("exception_date", { ascending: false }).limit(3),
      supabase.from("work_categories").select("id,name,is_active").order("sort_order").order("created_at"),
    ]);
    profile = results[0].data;
    reminders = results[1].data;
    terms = results[2].data;
    leaves = results[3].data;
    exceptions = results[4].data;
    categories = results[5].data ?? [];
  }

  const reminder = (type: string) => reminders?.find((row) => row.reminder_type === type);

  return (
    <div className="grid gap-6">
      <header><p className="muted text-sm">הכול בשליטה, במקום אחד</p><h1 className="text-3xl font-extrabold">הגדרות</h1></header>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SettingsCard icon={UserRound} title="פרופיל" description="הפרטים האישיים ואזור הזמן">
          <form action={saveProfile} className="grid gap-3">
            <Field label="שם משתמש" name="username" defaultValue={profile?.username} />
            <Field label="שם מלא" name="fullName" defaultValue={profile?.full_name ?? ""} />
            <label className="field"><span>אזור זמן</span><select className="input" name="timezone" defaultValue={profile?.timezone}><option value="Asia/Jerusalem">ישראל – ירושלים</option><option value="Europe/London">אירופה – לונדון</option><option value="America/New_York">אמריקה – ניו יורק</option></select></label>
            <div className="muted text-sm">דואר אלקטרוני: <b dir="ltr">{user.email}</b></div>
            <button className="button-primary">שמירת שינויים</button>
          </form>
        </SettingsCard>

        <SettingsCard icon={BriefcaseBusiness} title="שעות עבודה" description="ראשון עד חמישי · 08:30–17:00">
          <div className="grid grid-cols-5 gap-2 text-center">{["א׳", "ב׳", "ג׳", "ד׳", "ה׳"].map((day) => <span key={day} className="rounded-xl bg-[var(--primary-soft)] p-3 font-bold text-[var(--primary)]">{day}</span>)}</div>
          <p className="muted text-sm">שינוי שגרה יוצר גרסה חדשה מתאריך התחולה ושומר על דוחות היסטוריים.</p>
          <button className="button-secondary">יצירת שגרה חדשה</button>
          <WorkCategoriesSettings categories={categories} autoOpen={params.newCategory === "1"} />
        </SettingsCard>

        <SettingsCard icon={Coins} title="שכר" description="כל החישובים הם הערכה בלבד">
          <div className="rounded-2xl bg-[var(--background)] p-4"><p className="muted text-sm">מצב נוכחי</p><b>{terms?.mode === "hourly" ? "שכר שעתי · ₪" + terms.hourly_rate : terms?.mode === "global" ? "שכר חודשי · ₪" + terms.monthly_salary : "הצגת שכר כבויה"}</b></div>
          <button className="button-secondary">הוספת תנאי שכר מתאריך</button>
        </SettingsCard>

        <SettingsCard icon={CalendarHeart} title="חופשה ומחלה" description="דיווחים מלאים או חלקיים">
          <form action={addLeave} className="grid gap-3">
            <label className="field"><span>סוג היעדרות</span><select className="input" name="leaveType"><option value="vacation">חופשה</option><option value="sick">מחלה</option></select></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="מתאריך" name="startDate" type="date" required /><Field label="עד תאריך" name="endDate" type="date" required /></div>
            <Field label="דקות ליום חלקי" name="partialMinutes" type="number" />
            <Field label="הערה" name="note" />
            <button className="button-primary">הוספת היעדרות</button>
          </form>
          {leaves?.map((row) => <p key={row.id} className="rounded-xl bg-[var(--background)] p-3 text-sm"><b>{row.leave_type === "vacation" ? "חופשה" : "מחלה"}</b> · <span dir="ltr">{row.start_date}</span></p>)}
        </SettingsCard>

        <SettingsCard icon={CalendarRange} title="חגים וימים מיוחדים" description="חריגים לא משנים דיווחי עבודה קיימים">
          <form action={addException} className="grid gap-3">
            <Field label="תאריך" name="date" type="date" required />
            <label className="field"><span>סוג יום</span><select className="input" name="type"><option value="holiday">יום חג</option><option value="shortened">יום מקוצר</option><option value="day_off">יום חופשי נוסף</option><option value="special_workday">יום עבודה מיוחד</option></select></label>
            <Field label="שם היום" name="name" required />
            <Field label="יעד בדקות (לפי הצורך)" name="targetMinutes" type="number" />
            <button className="button-primary">שמירת יום מיוחד</button>
          </form>
          {exceptions?.map((row) => <p key={row.id} className="rounded-xl bg-[var(--background)] p-3 text-sm"><b>{row.name}</b> · <span dir="ltr">{row.exception_date}</span></p>)}
        </SettingsCard>

        <SettingsCard icon={Bell} title="תזכורות" description="תזכורות לפי אזור הזמן שלך">
          <form action={saveReminders} className="grid gap-3">
            <Toggle label="תזכורת כניסה" name="clockInEnabled" defaultChecked={reminder("clock_in")?.enabled} />
            <Field label="שעת תזכורת כניסה" name="clockInTime" type="time" defaultValue={reminder("clock_in")?.local_time?.slice(0, 5) ?? "08:25"} />
            <Toggle label="תזכורת יציאה" name="clockOutEnabled" defaultChecked={reminder("clock_out")?.enabled} />
            <Field label="שעת תזכורת יציאה" name="clockOutTime" type="time" defaultValue={reminder("clock_out")?.local_time?.slice(0, 5) ?? "17:05"} />
            <button className="button-primary">שמירת תזכורות</button>
          </form>
          <NotificationSettings />
        </SettingsCard>

        <SettingsCard icon={Accessibility} title="נגישות" description="ClockIn מכבדת את הגדרות המכשיר">
          <Toggle label="הפחתת תנועה" name="reducedMotion" />
          <Toggle label="קריאות גבוהה" name="readability" />
          <p className="muted text-sm">גודל הטקסט מותאם להגדרות המכשיר, וכל הפעולות זמינות גם באמצעות מקלדת.</p>
        </SettingsCard>
      </div>
      <form action={logoutAction}><button className="button-danger"><LogOut aria-hidden />יציאה מהחשבון</button></form>
    </div>
  );
}

function SettingsCard({ icon: Icon, title, description, children }: { icon: typeof UserRound; title: string; description: string; children: React.ReactNode }) {
  return <section className="card grid gap-4 p-5"><header className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon aria-hidden /></span><div><h2 className="text-xl font-extrabold">{title}</h2><p className="muted text-sm">{description}</p></div></header>{children}</section>;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  const id = "settings-" + rest.name;
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" {...rest} /></div>;
}

function Toggle({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="flex min-h-14 items-center justify-between rounded-2xl bg-[var(--background)] p-4"><b>{label}</b><input type="checkbox" className="size-5 accent-[var(--primary)]" {...props} /></label>;
}