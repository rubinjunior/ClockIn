import { describe, expect, it } from "vitest";
import { expectedMinutesForDate, reconcileReportDays } from "@/lib/reports/reconcile-days";
import type { ScheduleForBalance } from "@/lib/leave/balances";

const schedules: ScheduleForBalance[] = [{
  effectiveFrom: "2026-07-01",
  effectiveTo: null,
  days: Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    isWorkday: weekday <= 4,
    targetMinutes: weekday <= 4 ? 540 : 0,
  })),
}];

function reportDay(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-01",
    expectedMinutes: 0,
    workedMinutes: 482,
    creditedAbsenceMinutes: 0,
    manualAdjustmentMinutes: 0,
    finalBalanceMinutes: 482,
    missingMinutes: 0,
    overtimeMinutes: 482,
    sessions: 1,
    future: false,
    holidayLabel: null,
    shortenedDay: false,
    ...overrides,
  };
}

describe("התאמת נתוני הדוח לשגרת העבודה", () => {
  it("מעדיף את גרסת השגרה הפעילה על תקן RPC ישן", () => {
    expect(expectedMinutesForDate({
      date: "2026-07-01",
      rpcExpectedMinutes: 0,
      schedules,
      exceptions: [],
      rules: [],
    })).toBe(540);
  });

  it("מאפס את התקן בשישי ובשבת שלא סומנו כימי עבודה", () => {
    for (const date of ["2026-07-03", "2026-07-04"]) {
      const expectedMinutes = expectedMinutesForDate({
        date,
        rpcExpectedMinutes: 540,
        schedules,
        exceptions: [],
        rules: [],
      });
      const [day] = reconcileReportDays([reportDay({ date, expectedMinutes, workedMinutes: 0, sessions: 0 })], [], true);

      expect(day.expectedMinutes).toBe(0);
      expect(day.finalBalanceMinutes).toBe(0);
      expect(day.missingMinutes).toBe(0);
    }
  });
  it("מחשב את מקרה 08:59–17:01 כחוסר של 58 דקות", () => {
    const expectedMinutes = expectedMinutesForDate({
      date: "2026-07-01",
      rpcExpectedMinutes: 0,
      schedules,
      exceptions: [],
      rules: [],
    });
    const [day] = reconcileReportDays([{ ...reportDay(), expectedMinutes }], [], true);

    expect(day.workedMinutes).toBe(482);
    expect(day.expectedMinutes).toBe(540);
    expect(day.finalBalanceMinutes).toBe(-58);
    expect(day.missingMinutes).toBe(58);
    expect(day.overtimeMinutes).toBe(0);
  });

  it("מנרמל ערכים לא מספריים ולא מאפשר להם ליפול לסטטוס הושלם", () => {
    const [day] = reconcileReportDays([reportDay({
      expectedMinutes: 540,
      workedMinutes: Number.NaN,
      creditedAbsenceMinutes: Number.NaN,
      manualAdjustmentMinutes: Number.NaN,
      sessions: Number.NaN,
    })], [], true);

    expect(day.workedMinutes).toBe(0);
    expect(day.creditedAbsenceMinutes).toBe(0);
    expect(day.manualAdjustmentMinutes).toBe(0);
    expect(day.finalBalanceMinutes).toBe(-540);
    expect(day.missingMinutes).toBe(540);
  });

  it("שומר התאמה שלילית כחלק מהמאזן", () => {
    const [day] = reconcileReportDays([reportDay({
      expectedMinutes: 540,
      workedMinutes: 540,
      manualAdjustmentMinutes: -30,
    })], [], true);

    expect(day.manualAdjustmentMinutes).toBe(-30);
    expect(day.finalBalanceMinutes).toBe(-30);
  });
});
