import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsraelCalendarRules } from "@/lib/holidays/israel";
import { applyIsraelCalendar, type CalendarAwareReportDay } from "@/lib/reports/israel-calendar";
import { israelMonth, israelToday } from "@/lib/time/israel";

type ReportRow = {
  work_date: string;
  expected_minutes: number;
  worked_minutes: number;
  credited_absence_minutes: number;
  manual_adjustment_minutes: number;
  final_balance_minutes: number;
  missing_minutes: number;
  overtime_minutes: number;
  first_clock_in: string | null;
  last_clock_out: string | null;
  sessions: number;
  holiday_label: string | null;
  shortened_day: boolean;
  provisional?: boolean;
};

type CategoryRow = { category_name: string; minutes: number };

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll(`"`, `""`)}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "נדרשת כניסה" }, { status: 401 });

  const month = request.nextUrl.searchParams.get("month") ?? israelMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ message: "חודש לא תקין" }, { status: 400 });

  const first = `${month}-01`;
  const lastDate = new Date(`${month}-01T12:00:00Z`);
  lastDate.setUTCMonth(lastDate.getUTCMonth() + 1);
  lastDate.setUTCDate(0);
  const last = lastDate.toISOString().slice(0, 10);
  const [reportResult, categoriesResult, profileResult, calendarRules] = await Promise.all([
    supabase.rpc("monthly_report", { month_start: first, month_end: last, include_future: false }),
    supabase.rpc("monthly_category_summary", { month_start: first, month_end: last }),
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    getIsraelCalendarRules(Number(month.slice(0, 4))),
  ]);

  if (reportResult.error || categoriesResult.error || profileResult.error) {
    console.error("[report-csv] data query failed", {
      reportCode: reportResult.error?.code,
      categoriesCode: categoriesResult.error?.code,
      profileCode: profileResult.error?.code,
    });
    return NextResponse.json({ message: "לא ניתן לייצא את הדוח כרגע" }, { status: 500 });
  }

  const today = israelToday();
  const originalRows = (reportResult.data ?? []) as ReportRow[];
  const baseDays: CalendarAwareReportDay[] = originalRows.map((row) => ({
    date: row.work_date,
    expectedMinutes: Number(row.expected_minutes) || 0,
    workedMinutes: Number(row.worked_minutes) || 0,
    creditedAbsenceMinutes: Number(row.credited_absence_minutes) || 0,
    manualAdjustmentMinutes: Number(row.manual_adjustment_minutes) || 0,
    finalBalanceMinutes: Number(row.final_balance_minutes) || 0,
    missingMinutes: Number(row.missing_minutes) || 0,
    overtimeMinutes: Number(row.overtime_minutes) || 0,
    sessions: Number(row.sessions) || 0,
    future: row.work_date > today,
    holidayLabel: row.holiday_label,
    shortenedDay: Boolean(row.shortened_day),
    provisional: Boolean(row.provisional),
  }));
  const days = applyIsraelCalendar(baseDays, calendarRules, false);
  const originalByDate = new Map(originalRows.map((row) => [row.work_date, row]));

  const lines = [
    csvRow(["תאריך", "דקות צפויות", "דקות עבודה", "דקות היעדרות", "התאמות", "מאזן", "חוסר", "עודף", "כניסה ראשונה", "יציאה אחרונה", "מספר דיווחים", "חג / סטטוס"]),
    ...days.map((day) => {
      const original = originalByDate.get(day.date);
      const status = day.holidayLabel ?? (day.future ? "עתידי" : day.provisional ? "בתהליך" : "הושלם");
      return csvRow([
        day.date,
        day.expectedMinutes,
        day.workedMinutes,
        day.creditedAbsenceMinutes,
        day.manualAdjustmentMinutes,
        day.finalBalanceMinutes,
        day.missingMinutes,
        day.overtimeMinutes,
        original?.first_clock_in ?? "",
        original?.last_clock_out ?? "",
        day.sessions,
        status,
      ]);
    }),
  ];

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  if (categories.length) {
    lines.push("", csvRow(["סיכום קטגוריות", "דקות"]));
    for (const category of categories) lines.push(csvRow([category.category_name, Number(category.minutes) || 0]));
  }

  const safeName = (profileResult.data?.username ?? "user").replace(/[^\p{L}\p{N}_-]+/gu, "_");
  return new NextResponse("\uFEFF" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`ClockIn_${safeName}_${month}.csv`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}