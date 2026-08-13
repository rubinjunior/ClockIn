import type { CalendarAwareReportDay } from "@/lib/reports/israel-calendar";
import type { LeaveEntryForBalance, ScheduleForBalance } from "@/lib/leave/balances";
import type { IsraelCalendarRule } from "@/lib/holidays/israel";

export type ReportCalendarException = {
  date: string;
  type: "holiday" | "shortened" | "day_off" | "special_workday";
  targetMinutes: number | null;
};

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function minutes(value: unknown) {
  return Math.max(0, integer(value));
}

export function scheduledMinutesForDate(date: string, schedules: ScheduleForBalance[]) {
  const schedule = schedules
    .filter((item) => item.effectiveFrom <= date && (!item.effectiveTo || item.effectiveTo >= date))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (!schedule) return null;

  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const scheduleDay = schedule.days.find((day) => day.weekday === weekday);
  return scheduleDay?.isWorkday ? minutes(scheduleDay.targetMinutes) : 0;
}

export function expectedMinutesForDate({
  date,
  rpcExpectedMinutes,
  schedules,
  exceptions,
  rules,
}: {
  date: string;
  rpcExpectedMinutes: unknown;
  schedules: ScheduleForBalance[];
  exceptions: ReportCalendarException[];
  rules: IsraelCalendarRule[];
}) {
  const scheduled = scheduledMinutesForDate(date, schedules);
  let expected = scheduled ?? minutes(rpcExpectedMinutes);
  const exception = exceptions.find((item) => item.date === date);

  if (exception) {
    if (exception.type === "holiday" || exception.type === "day_off") return 0;
    return exception.targetMinutes == null ? expected : minutes(exception.targetMinutes);
  }

  const rule = rules.find((item) => item.date === date);
  if (rule?.type === "holiday") return 0;
  if (rule?.type === "shortened" && expected > 0) expected = Math.min(expected, minutes(rule.targetMinutes));
  return expected;
}

function creditedLeaveMinutes(day: CalendarAwareReportDay, leaves: LeaveEntryForBalance[]) {
  if (day.expectedMinutes <= 0) return 0;
  return leaves
    .filter((leave) => leave.startDate <= day.date && leave.endDate >= day.date)
    .reduce((maximum, leave) => Math.max(
      maximum,
      leave.partialMinutes == null ? day.expectedMinutes : Math.min(day.expectedMinutes, minutes(leave.partialMinutes)),
    ), 0);
}

export function reconcileReportDays<T extends CalendarAwareReportDay>(
  days: T[],
  leaves: LeaveEntryForBalance[],
  includeFuture: boolean,
): T[] {
  return days.map((day) => {
    const expectedMinutes = minutes(day.expectedMinutes);
    const future = Boolean(day.future);
    const workedMinutes = future ? 0 : minutes(day.workedMinutes);
    const creditedAbsenceMinutes = future && !includeFuture ? 0 : creditedLeaveMinutes({ ...day, expectedMinutes }, leaves);
    const manualAdjustmentMinutes = future ? 0 : integer(day.manualAdjustmentMinutes);
    const finalBalanceMinutes = future
      ? 0
      : workedMinutes + creditedAbsenceMinutes + manualAdjustmentMinutes - expectedMinutes;

    return {
      ...day,
      expectedMinutes: future && !includeFuture ? 0 : expectedMinutes,
      workedMinutes,
      creditedAbsenceMinutes,
      manualAdjustmentMinutes,
      finalBalanceMinutes,
      missingMinutes: future || day.provisional ? 0 : Math.max(0, -finalBalanceMinutes),
      overtimeMinutes: future ? 0 : Math.max(0, finalBalanceMinutes),
      sessions: future ? 0 : minutes(day.sessions),
    };
  });
}
