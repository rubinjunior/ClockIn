export type AnalyticsDay = {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  creditedAbsenceMinutes: number;
  manualAdjustmentMinutes: number;
  finalBalanceMinutes: number;
  sessions: number;
  future: boolean;
  provisional?: boolean;
  holidayLabel?: string | null;
  shortenedDay?: boolean;
};

export type AnalyticsLeave = {
  leaveType: "vacation" | "sick";
  startDate: string;
  endDate: string;
  partialMinutes: number | null;
};

export type AnalyticsEntry = {
  id: string;
  clockIn: string;
  clockOut: string;
};

export type ReportDayStatus =
  | "future"
  | "inProgress"
  | "holiday"
  | "shortened"
  | "vacation"
  | "sick"
  | "incomplete"
  | "missingReport"
  | "missingHours"
  | "overtime"
  | "nonWorkday"
  | "completed";

export type ReportWeek = {
  key: string;
  number: number;
  startDate: string;
  endDate: string;
  expectedMinutes: number;
  workedMinutes: number;
  creditedMinutes: number;
  adjustmentMinutes: number;
  balanceMinutes: number;
  status: "completed" | "current" | "future";
};

export type ReportAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  kind: "incomplete" | "missingReport" | "leaveWork" | "nonWorkday" | "weekDeficit" | "overlap";
  date?: string;
  weekStart?: string;
};

function dateAtNoon(date: string) {
  return new Date(date + "T12:00:00Z");
}

function addDays(date: string, amount: number) {
  const value = dateAtNoon(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function sundayOf(date: string) {
  return addDays(date, -dateAtNoon(date).getUTCDay());
}

function matchingLeave(day: AnalyticsDay, leaves: AnalyticsLeave[]) {
  return leaves.find((leave) => leave.startDate <= day.date && leave.endDate >= day.date);
}

function plannedLeaveCredit(day: AnalyticsDay, leaves: AnalyticsLeave[]) {
  const leave = matchingLeave(day, leaves);
  if (!leave || day.expectedMinutes <= 0) return 0;
  return leave.partialMinutes == null ? day.expectedMinutes : Math.min(day.expectedMinutes, leave.partialMinutes);
}

export function getReportDayStatus(day: AnalyticsDay, leaves: AnalyticsLeave[], incompleteDates: Set<string>): ReportDayStatus {
  if (day.future) return "future";
  if (incompleteDates.has(day.date)) return "incomplete";
  if (day.provisional) return "inProgress";
  if (day.holidayLabel && day.expectedMinutes === 0) return "holiday";
  if (day.shortenedDay) return "shortened";
  const leave = matchingLeave(day, leaves);
  if (leave?.leaveType === "vacation" && day.creditedAbsenceMinutes > 0) return "vacation";
  if (leave?.leaveType === "sick" && day.creditedAbsenceMinutes > 0) return "sick";
  if (day.expectedMinutes === 0) return day.workedMinutes > 0 ? "overtime" : "nonWorkday";
  if (day.workedMinutes === 0 && day.creditedAbsenceMinutes === 0 && day.manualAdjustmentMinutes === 0) return "missingReport";
  const balance = day.workedMinutes + day.creditedAbsenceMinutes + day.manualAdjustmentMinutes - day.expectedMinutes;
  if (balance < 0) return "missingHours";
  if (balance > 0) return "overtime";
  return "completed";
}

function buildWeeks(days: AnalyticsDay[], today: string): ReportWeek[] {
  const groups = new Map<string, AnalyticsDay[]>();
  for (const day of days) {
    const key = sundayOf(day.date);
    const group = groups.get(key) ?? [];
    group.push(day);
    groups.set(key, group);
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, weekDays], index) => {
    const startDate = weekDays[0].date;
    const endDate = weekDays.at(-1)!.date;
    const elapsed = weekDays.filter((day) => day.date <= today);
    const elapsedExpectedMinutes = elapsed.reduce((sum, day) => sum + day.expectedMinutes, 0);
    const fullExpectedMinutes = weekDays.reduce((sum, day) => sum + day.expectedMinutes, 0);
    const workedMinutes = elapsed.reduce((sum, day) => sum + day.workedMinutes, 0);
    const creditedMinutes = elapsed.reduce((sum, day) => sum + day.creditedAbsenceMinutes, 0);
    const adjustmentMinutes = elapsed.reduce((sum, day) => sum + day.manualAdjustmentMinutes, 0);
    const status = startDate > today ? "future" : endDate < today ? "completed" : "current";
    return {
      key,
      number: index + 1,
      startDate,
      endDate,
      expectedMinutes: status === "future" ? fullExpectedMinutes : elapsedExpectedMinutes,
      workedMinutes,
      creditedMinutes,
      adjustmentMinutes,
      balanceMinutes: status === "future" ? 0 : workedMinutes + creditedMinutes + adjustmentMinutes - elapsedExpectedMinutes,
      status,
    };
  });
}

function entriesOverlap(a: AnalyticsEntry, b: AnalyticsEntry) {
  return new Date(a.clockIn).getTime() < new Date(b.clockOut).getTime()
    && new Date(b.clockIn).getTime() < new Date(a.clockOut).getTime();
}

function commonDailyTarget(days: AnalyticsDay[]) {
  const counts = new Map<number, number>();
  for (const day of days) {
    if (day.expectedMinutes <= 0 || day.shortenedDay) continue;
    counts.set(day.expectedMinutes, (counts.get(day.expectedMinutes) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
}

export function buildReportAnalytics({
  days,
  today,
  leaves,
  incompleteEntryDates = [],
  entries = [],
}: {
  days: AnalyticsDay[];
  today: string;
  leaves: AnalyticsLeave[];
  incompleteEntryDates?: string[];
  entries?: AnalyticsEntry[];
}) {
  const incompleteDates = new Set(incompleteEntryDates);
  const elapsedDays = days.filter((day) => day.date <= today);
  const futureDays = days.filter((day) => day.date > today);
  const fullTargetMinutes = days.reduce((sum, day) => sum + day.expectedMinutes, 0);
  const targetToDateMinutes = elapsedDays.reduce((sum, day) => sum + day.expectedMinutes, 0);
  const workedToDateMinutes = elapsedDays.reduce((sum, day) => sum + day.workedMinutes, 0);
  const creditedToDateMinutes = elapsedDays.reduce((sum, day) => sum + day.creditedAbsenceMinutes, 0);
  const adjustmentToDateMinutes = elapsedDays.reduce((sum, day) => sum + day.manualAdjustmentMinutes, 0);
  const balanceToDateMinutes = workedToDateMinutes + creditedToDateMinutes + adjustmentToDateMinutes - targetToDateMinutes;
  const futureLeaveCreditMinutes = futureDays.reduce((sum, day) => sum + plannedLeaveCredit(day, leaves), 0);
  const remainingEffectiveDays = futureDays.filter((day) => day.expectedMinutes - plannedLeaveCredit(day, leaves) > 0).length;
  const remainingRequiredMinutes = Math.max(0, fullTargetMinutes - workedToDateMinutes - creditedToDateMinutes - adjustmentToDateMinutes - futureLeaveCreditMinutes);
  const requiredDailyAverageMinutes = remainingEffectiveDays > 0 ? Math.ceil(remainingRequiredMinutes / remainingEffectiveDays) : 0;
  const elapsedTargetDays = elapsedDays.filter((day) => day.expectedMinutes > 0);
  const averageWorkedMinutes = elapsedTargetDays.length > 0 ? workedToDateMinutes / elapsedTargetDays.length : 0;
  const projectedEquivalentMinutes = workedToDateMinutes + creditedToDateMinutes + adjustmentToDateMinutes
    + averageWorkedMinutes * remainingEffectiveDays + futureLeaveCreditMinutes;
  const projectedBalanceMinutes = elapsedTargetDays.length >= 3 ? Math.round(projectedEquivalentMinutes - fullTargetMinutes) : null;
  const weeks = buildWeeks(days, today);
  const statusByDate = Object.fromEntries(days.map((day) => [day.date, getReportDayStatus(day, leaves, incompleteDates)])) as Record<string, ReportDayStatus>;

  const alerts: ReportAlert[] = [];
  for (const day of elapsedDays) {
    const status = statusByDate[day.date];
    if (status === "incomplete") {
      alerts.push({ id: `incomplete-${day.date}`, severity: "critical", kind: "incomplete", date: day.date });
    } else if (status === "missingReport") {
      alerts.push({ id: `missing-${day.date}`, severity: "critical", kind: "missingReport", date: day.date });
    }
    if (day.creditedAbsenceMinutes >= day.expectedMinutes && day.expectedMinutes > 0 && day.workedMinutes > 0) {
      alerts.push({ id: `leave-work-${day.date}`, severity: "warning", kind: "leaveWork", date: day.date });
    }
    if (day.expectedMinutes === 0 && day.workedMinutes > 0) {
      alerts.push({ id: `non-work-${day.date}`, severity: "info", kind: "nonWorkday", date: day.date });
    }
  }
  for (const week of weeks) {
    if (week.status === "completed" && week.balanceMinutes < 0) {
      alerts.push({ id: `week-${week.key}`, severity: "warning", kind: "weekDeficit", weekStart: week.key });
    }
  }
  const sortedEntries = [...entries].sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  for (let index = 0; index < sortedEntries.length - 1; index += 1) {
    const current = sortedEntries[index];
    const next = sortedEntries[index + 1];
    if (entriesOverlap(current, next)) {
      alerts.push({ id: `overlap-${current.id}-${next.id}`, severity: "critical", kind: "overlap" });
    }
  }

  return {
    commonDailyTargetMinutes: commonDailyTarget(days),
    totalWorkdays: days.filter((day) => day.expectedMinutes > 0).length,
    remainingWorkdays: futureDays.filter((day) => day.expectedMinutes > 0).length,
    holidayDays: days.filter((day) => day.holidayLabel && day.expectedMinutes === 0).length,
    shortenedDays: days.filter((day) => day.shortenedDay).length,
    fullTargetMinutes,
    targetToDateMinutes,
    workedToDateMinutes,
    creditedToDateMinutes,
    adjustmentToDateMinutes,
    balanceToDateMinutes,
    futureLeaveCreditMinutes,
    remainingRequiredMinutes,
    requiredDailyAverageMinutes,
    projectedBalanceMinutes,
    weeks,
    statusByDate,
    alerts,
  };
}
