import type { TimeEntry } from "@/types/domain";
import { israelToday } from "@/lib/time/israel";

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@clockin.local",
  user_metadata: { username: "נועה לדוגמה" },
};

export function isDemoMode() {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true";
}

export function demoEntries(): Array<TimeEntry & { edit_reason: string | null; updated_at: string; created_at: string }> {
  return [];
}

export function demoReportRows(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + 1);
  const today = israelToday();
  const rows = [];
  for (const day = new Date(first); day < next; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    const workday = day.getUTCDay() <= 4;
    const future = date > today;
    const expectedMinutes = workday ? 510 : 0;
    const workedMinutes = 0;
    const finalBalanceMinutes = future ? 0 : workedMinutes - expectedMinutes;
    rows.push({ date, expectedMinutes, workedMinutes, creditedAbsenceMinutes: 0, manualAdjustmentMinutes: 0, finalBalanceMinutes, missingMinutes: future ? 0 : Math.max(0, -finalBalanceMinutes), overtimeMinutes: Math.max(0, finalBalanceMinutes), sessions: workedMinutes ? 1 : 0, future });
  }
  return rows;
}
