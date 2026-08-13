import { describe, expect, it } from "vitest";
import { buildReportAnalytics, getReportDayStatus, type AnalyticsDay } from "@/lib/reports/analytics";

function day(date: string, overrides: Partial<AnalyticsDay> = {}): AnalyticsDay {
  return {
    date,
    expectedMinutes: 480,
    workedMinutes: 0,
    creditedAbsenceMinutes: 0,
    manualAdjustmentMinutes: 0,
    finalBalanceMinutes: -480,
    sessions: 0,
    future: false,
    ...overrides,
  };
}

describe("ניתוח דוח חודשי", () => {
  it("מפריד בין התקן המצטבר לתקן החודשי", () => {
    const result = buildReportAnalytics({
      today: "2026-06-03",
      days: [
        day("2026-06-01", { workedMinutes: 480, sessions: 1 }),
        day("2026-06-02", { workedMinutes: 480, sessions: 1 }),
        day("2026-06-03", { provisional: true }),
        day("2026-06-04", { future: true, finalBalanceMinutes: 0 }),
        day("2026-06-05", { future: true, finalBalanceMinutes: 0 }),
      ],
      leaves: [],
    });

    expect(result.fullTargetMinutes).toBe(2400);
    expect(result.targetToDateMinutes).toBe(1440);
    expect(result.workedToDateMinutes).toBe(960);
    expect(result.balanceToDateMinutes).toBe(-480);
    expect(result.remainingWorkdays).toBe(2);
    expect(result.requiredDailyAverageMinutes).toBe(720);
  });

  it("מוריד חופשה עתידית מאומצת העבודה שנותרה", () => {
    const result = buildReportAnalytics({
      today: "2026-06-01",
      days: [
        day("2026-06-01", { workedMinutes: 480, sessions: 1 }),
        day("2026-06-02", { future: true, finalBalanceMinutes: 0 }),
        day("2026-06-03", { future: true, finalBalanceMinutes: 0 }),
      ],
      leaves: [{ leaveType: "vacation", startDate: "2026-06-03", endDate: "2026-06-03", partialMinutes: null }],
    });

    expect(result.futureLeaveCreditMinutes).toBe(480);
    expect(result.remainingRequiredMinutes).toBe(480);
    expect(result.requiredDailyAverageMinutes).toBe(480);
  });

  it("מסווג עתיד, יום חסר, דיווח חלקי והיעדרות", () => {
    const leaves = [{ leaveType: "sick" as const, startDate: "2026-06-03", endDate: "2026-06-03", partialMinutes: null }];
    expect(getReportDayStatus(day("2026-06-10", { future: true }), leaves, new Set())).toBe("future");
    expect(getReportDayStatus(day("2026-06-03", { future: true }), leaves, new Set())).toBe("sick");
    expect(getReportDayStatus(day("2026-06-01"), leaves, new Set())).toBe("missingReport");
    expect(getReportDayStatus(day("2026-06-02", { workedMinutes: 300, sessions: 1 }), leaves, new Set())).toBe("missingHours");
    expect(getReportDayStatus(day("2026-06-03", { creditedAbsenceMinutes: 480 }), leaves, new Set())).toBe("sick");
  });

  it("מסווג דיווח 08:59–17:01 כחוסר מול תקן 09:00–18:00", () => {
    expect(getReportDayStatus(day("2026-07-01", {
      expectedMinutes: 540,
      workedMinutes: 482,
      finalBalanceMinutes: -58,
      sessions: 1,
    }), [], new Set())).toBe("missingHours");
  });

  it("לא מסווג ערכים מספריים פגומים כהושלם", () => {
    expect(getReportDayStatus(day("2026-07-02", {
      workedMinutes: Number.NaN,
      creditedAbsenceMinutes: Number.NaN,
      manualAdjustmentMinutes: Number.NaN,
    }), [], new Set())).toBe("missingReport");
  });

  it("משאיר יום שלא הוגדר כיום עבודה ללא חוסר או תקן", () => {
    expect(getReportDayStatus(day("2026-06-06", {
      expectedMinutes: 0,
      finalBalanceMinutes: 0,
    }), [], new Set())).toBe("unscheduled");
  });

  it("משאיר יום חג ללא דיווח כסטטוס חג", () => {
    expect(getReportDayStatus(day("2026-06-06", {
      expectedMinutes: 0,
      finalBalanceMinutes: 0,
      holidayLabel: "חג",
    }), [], new Set())).toBe("holiday");
  });

  it("מייצר התראות לדיווח חסר, דיווח פתוח וחפיפה", () => {
    const result = buildReportAnalytics({
      today: "2026-06-02",
      days: [day("2026-06-01"), day("2026-06-02")],
      leaves: [],
      incompleteEntryDates: ["2026-06-02"],
      entries: [
        { id: "a", clockIn: "2026-06-01T08:00:00Z", clockOut: "2026-06-01T10:00:00Z" },
        { id: "b", clockIn: "2026-06-01T09:00:00Z", clockOut: "2026-06-01T11:00:00Z" },
      ],
    });

    expect(result.alerts.map((alert) => alert.kind)).toEqual(expect.arrayContaining(["missingReport", "incomplete", "overlap"]));
  });

  it("מחלק כל חודש לרצפים של שבעה ימים ומאפס את מספור השבועות בחודש הבא", () => {
    const augustDays = Array.from({ length: 31 }, (_, index) =>
      day(`2026-08-${String(index + 1).padStart(2, "0")}`),
    );
    const result = buildReportAnalytics({
      today: "2026-08-13",
      days: [...augustDays, day("2026-09-01", { future: true })],
      leaves: [],
    });

    expect(result.weeks.map((week) => ({ number: week.number, start: week.startDate, end: week.endDate }))).toEqual([
      { number: 1, start: "2026-08-01", end: "2026-08-07" },
      { number: 2, start: "2026-08-08", end: "2026-08-14" },
      { number: 3, start: "2026-08-15", end: "2026-08-21" },
      { number: 4, start: "2026-08-22", end: "2026-08-28" },
      { number: 5, start: "2026-08-29", end: "2026-08-31" },
      { number: 1, start: "2026-09-01", end: "2026-09-01" },
    ]);
  });
  it("מתריע רק על שבוע שהסתיים ולא על השבוע הנוכחי", () => {
    const result = buildReportAnalytics({
      today: "2026-06-09",
      days: [
        day("2026-06-01"),
        day("2026-06-02"),
        day("2026-06-08"),
        day("2026-06-09", { provisional: true }),
      ],
      leaves: [],
    });

    expect(result.weeks).toHaveLength(2);
    expect(result.weeks[0].status).toBe("completed");
    expect(result.weeks[1].status).toBe("current");
    expect(result.alerts.filter((alert) => alert.kind === "weekDeficit")).toHaveLength(1);
  });
});
