import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { addDays, differenceInSeconds, format, startOfDay } from "date-fns";
import type { DailyBalance, DailyCalculationInput, TimeEntry } from "@/types/domain";

export function calculateDailyBalance(input: DailyCalculationInput): DailyBalance {
  const finalBalanceMinutes = input.workedMinutes + input.creditedAbsenceMinutes + input.manualAdjustmentMinutes - input.expectedMinutes;
  return { ...input, finalBalanceMinutes, missingMinutes: input.future ? 0 : Math.max(0, -finalBalanceMinutes), overtimeMinutes: Math.max(0, finalBalanceMinutes) };
}

export function minutesBetween(start: string, end: string): number {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  if (startTotal === endTotal) return 0;
  return endTotal > startTotal ? endTotal - startTotal : 1440 - startTotal + endTotal;
}

export function calculateMonthlyBalance(days: DailyBalance[]) {
  return days.reduce((sum, day) => ({
    expectedMinutes: sum.expectedMinutes + day.expectedMinutes,
    workedMinutes: sum.workedMinutes + day.workedMinutes,
    creditedAbsenceMinutes: sum.creditedAbsenceMinutes + day.creditedAbsenceMinutes,
    manualAdjustmentMinutes: sum.manualAdjustmentMinutes + day.manualAdjustmentMinutes,
    missingMinutes: sum.missingMinutes + day.missingMinutes,
    overtimeMinutes: sum.overtimeMinutes + day.overtimeMinutes,
    finalBalanceMinutes: sum.finalBalanceMinutes + day.finalBalanceMinutes,
  }), { expectedMinutes: 0, workedMinutes: 0, creditedAbsenceMinutes: 0, manualAdjustmentMinutes: 0, missingMinutes: 0, overtimeMinutes: 0, finalBalanceMinutes: 0 });
}

export function sessionsOverlap(a: Pick<TimeEntry, "clockIn" | "clockOut">, b: Pick<TimeEntry, "clockIn" | "clockOut">): boolean {
  const aStart = new Date(a.clockIn).getTime();
  const bStart = new Date(b.clockIn).getTime();
  const aEnd = a.clockOut ? new Date(a.clockOut).getTime() : Number.POSITIVE_INFINITY;
  const bEnd = b.clockOut ? new Date(b.clockOut).getTime() : Number.POSITIVE_INFINITY;
  return aStart < bEnd && bStart < aEnd;
}

export function splitSessionByLocalDate(entry: Pick<TimeEntry, "clockIn" | "clockOut">, timezone: string): Record<string, number> {
  if (!entry.clockOut) return {};
  const startUtc = new Date(entry.clockIn);
  const endUtc = new Date(entry.clockOut);
  if (endUtc <= startUtc) throw new Error("clock_out_before_clock_in");
  const result: Record<string, number> = {};
  let cursor = startUtc;
  while (cursor < endUtc) {
    const localCursor = toZonedTime(cursor, timezone);
    const key = format(localCursor, "yyyy-MM-dd");
    const nextLocalMidnight = startOfDay(addDays(localCursor, 1));
    const nextUtcMidnight = fromZonedTime(nextLocalMidnight, timezone);
    const segmentEnd = nextUtcMidnight < endUtc ? nextUtcMidnight : endUtc;
    result[key] = (result[key] ?? 0) + Math.round(differenceInSeconds(segmentEnd, cursor) / 60);
    cursor = segmentEnd;
  }
  return result;
}

export function estimateHourlyCompensation(minutes: number, hourlyRate: number): number {
  return Math.round((minutes / 60) * hourlyRate * 100) / 100;
}

export function isReminderDue(localTime: string, now: Date, timezone: string, weekdays: number[], toleranceMinutes = 5): boolean {
  const local = toZonedTime(now, timezone);
  const weekday = local.getDay();
  if (!weekdays.includes(weekday)) return false;
  const [hours, minutes] = localTime.split(":").map(Number);
  const currentMinutes = local.getHours() * 60 + local.getMinutes();
  return currentMinutes >= hours * 60 + minutes && currentMinutes < hours * 60 + minutes + toleranceMinutes;
}
