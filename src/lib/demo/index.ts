import type { TimeEntry } from "@/types/domain";

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@clockin.local",
  user_metadata: { username: "נועה לדוגמה" },
};

export function isDemoMode() {
  return process.env.NODE_ENV !== "production" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function at(daysAgo: number, hours: number, minutes = 0) {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(hours, minutes, 0, 0);
  return value.toISOString();
}

export function demoEntries(): Array<TimeEntry & { edit_reason: string | null; updated_at: string; created_at: string }> {
  return [
    { id: "demo-1", clockIn: at(1, 8, 27), clockOut: at(1, 17, 4), source: "clock", note: "יום עבודה רגיל", edit_reason: null, created_at: at(1, 17, 4), updated_at: at(1, 17, 4) },
    { id: "demo-2", clockIn: at(2, 8, 41), clockOut: at(2, 16, 52), source: "clock", note: null, edit_reason: null, created_at: at(2, 16, 52), updated_at: at(2, 16, 52) },
    { id: "demo-3", clockIn: at(3, 9, 5), clockOut: at(3, 17, 30), source: "manual", note: "פגישה מחוץ למשרד", edit_reason: "השלמת דיווח", created_at: at(3, 17, 30), updated_at: at(3, 18, 0) },
  ];
}

export function demoReportRows(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + 1);
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  for (const day = new Date(first); day < next; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    const workday = day.getUTCDay() <= 4;
    const future = date > today;
    const expectedMinutes = workday && !future ? 510 : 0;
    const seed = day.getUTCDate() % 5;
    const workedMinutes = expectedMinutes ? [510, 485, 535, 510, 450][seed] : 0;
    const finalBalanceMinutes = workedMinutes - expectedMinutes;
    rows.push({ date, expectedMinutes, workedMinutes, creditedAbsenceMinutes: 0, manualAdjustmentMinutes: 0, finalBalanceMinutes, missingMinutes: Math.max(0, -finalBalanceMinutes), overtimeMinutes: Math.max(0, finalBalanceMinutes), sessions: workedMinutes ? 1 : 0, future });
  }
  return rows;
}
