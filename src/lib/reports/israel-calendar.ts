import type { IsraelCalendarRule } from "@/lib/holidays/israel";

export type CalendarAwareReportDay = {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  creditedAbsenceMinutes: number;
  manualAdjustmentMinutes: number;
  finalBalanceMinutes: number;
  missingMinutes: number;
  overtimeMinutes: number;
  sessions: number;
  future: boolean;
  holidayLabel?: string | null;
  shortenedDay?: boolean;
  provisional?: boolean;
};

export function applyIsraelCalendar<T extends CalendarAwareReportDay>(days: T[], rules: IsraelCalendarRule[], includeFuture: boolean): T[] {
  const byDate = new Map(rules.map((rule) => [rule.date, rule]));
  return days.map((day) => {
    const rule = day.holidayLabel ? undefined : byDate.get(day.date);
    let expectedMinutes = day.expectedMinutes;
    let holidayLabel = day.holidayLabel ?? null;
    let shortenedDay = day.shortenedDay ?? false;
    if (rule?.type === "holiday") {
      expectedMinutes = 0;
      holidayLabel = rule.name;
      shortenedDay = false;
    } else if (rule?.type === "shortened") {
      expectedMinutes = expectedMinutes > 0 ? Math.min(expectedMinutes, rule.targetMinutes) : 0;
      holidayLabel = rule.name;
      shortenedDay = expectedMinutes > 0;
    }
    if (day.future) return { ...day, expectedMinutes: includeFuture ? expectedMinutes : 0, workedMinutes: 0, creditedAbsenceMinutes: 0, manualAdjustmentMinutes: 0, finalBalanceMinutes: 0, missingMinutes: 0, overtimeMinutes: 0, sessions: 0, holidayLabel, shortenedDay };
    const finalBalanceMinutes = day.workedMinutes + day.creditedAbsenceMinutes + day.manualAdjustmentMinutes - expectedMinutes;
    return { ...day, expectedMinutes, finalBalanceMinutes, missingMinutes: day.provisional ? 0 : Math.max(0, -finalBalanceMinutes), overtimeMinutes: Math.max(0, finalBalanceMinutes), holidayLabel, shortenedDay };
  });
}