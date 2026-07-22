import type { IsraelCalendarRule } from "@/lib/holidays/israel";

export type LeaveType = "vacation" | "sick";
export type LeaveEntryForBalance = { leaveType: LeaveType; startDate: string; endDate: string; partialMinutes: number | null };
export type ScheduleForBalance = { effectiveFrom: string; effectiveTo: string | null; days: Array<{ weekday: number; isWorkday: boolean; targetMinutes: number }> };
export type ExceptionForBalance = { date: string; type: "holiday" | "shortened" | "day_off" | "special_workday"; targetMinutes: number | null };

function addDate(date: string, amount: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function expectedMinutes(date: string, schedules: ScheduleForBalance[], exceptions: ExceptionForBalance[], rules: IsraelCalendarRule[]) {
  const schedule = schedules.find((item) => item.effectiveFrom <= date && (!item.effectiveTo || item.effectiveTo >= date));
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  let target = schedule?.days.find((day) => day.weekday === weekday && day.isWorkday)?.targetMinutes ?? 0;
  const exception = exceptions.find((item) => item.date === date);
  if (exception) {
    if (exception.type === "holiday" || exception.type === "day_off") return 0;
    return exception.targetMinutes ?? target;
  }
  const rule = rules.find((item) => item.date === date);
  if (rule?.type === "holiday") return 0;
  if (rule?.type === "shortened" && target > 0) target = Math.min(target, rule.targetMinutes);
  return target;
}

export function calculateLeaveBalances({ asOf, adjustments, leaves, schedules, exceptions, rules }: {
  asOf: string;
  adjustments: Array<{ leaveType: LeaveType; minutes: number }>;
  leaves: LeaveEntryForBalance[];
  schedules: ScheduleForBalance[];
  exceptions: ExceptionForBalance[];
  rules: IsraelCalendarRule[];
}) {
  const balances: Record<LeaveType, number> = { vacation: 0, sick: 0 };
  for (const adjustment of adjustments) balances[adjustment.leaveType] += adjustment.minutes;

  const usage = new Map<string, number>();
  for (const leave of leaves) {
    const last = leave.endDate < asOf ? leave.endDate : asOf;
    for (let date = leave.startDate; date <= last; date = addDate(date, 1)) {
      const expected = expectedMinutes(date, schedules, exceptions, rules);
      if (expected <= 0) continue;
      const minutes = leave.partialMinutes == null ? expected : Math.min(expected, leave.partialMinutes);
      const key = `${leave.leaveType}:${date}`;
      usage.set(key, Math.max(usage.get(key) ?? 0, minutes));
    }
  }

  for (const [key, minutes] of usage) balances[key.startsWith("vacation:") ? "vacation" : "sick"] -= minutes;
  return balances;
}

export function countLeaveDaysForReport(entries: LeaveEntryForBalance[], type: LeaveType, days: Array<{ date: string; expectedMinutes: number }>) {
  return days.reduce((total, day) => {
    if (day.expectedMinutes <= 0) return total;
    const matching = entries.filter((entry) => entry.leaveType === type && entry.startDate <= day.date && entry.endDate >= day.date);
    const credited = matching.reduce((maximum, entry) => Math.max(maximum, entry.partialMinutes == null ? day.expectedMinutes : Math.min(day.expectedMinutes, entry.partialMinutes)), 0);
    return total + credited / day.expectedMinutes;
  }, 0);
}
