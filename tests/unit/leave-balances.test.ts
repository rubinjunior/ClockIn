import { describe, expect, it } from "vitest";
import { calculateLeaveBalances, countLeaveDaysForReport } from "@/lib/leave/balances";

const schedule = [{
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  days: Array.from({ length: 7 }, (_, weekday) => ({ weekday, isWorkday: weekday <= 4, targetMinutes: weekday <= 4 ? 540 : 0 })),
}];

describe("leave balances", () => {
  it("deducts approved leave only on expected workdays and respects holidays", () => {
    const result = calculateLeaveBalances({
      asOf: "2026-09-14",
      adjustments: [{ leaveType: "vacation", minutes: 3_000 }],
      leaves: [{ leaveType: "vacation", startDate: "2026-09-10", endDate: "2026-09-14", partialMinutes: null }],
      schedules: schedule,
      exceptions: [],
      rules: [{ date: "2026-09-13", name: "ראש השנה", type: "holiday", targetMinutes: 0 }],
    });
    // Thursday and Monday are workdays; Friday, Saturday and the Sunday holiday are not charged.
    expect(result.vacation).toBe(3_000 - 1_080);
  });

  it("uses exact partial-day fractions in report cards", () => {
    const value = countLeaveDaysForReport(
      [{ leaveType: "sick", startDate: "2026-07-20", endDate: "2026-07-20", partialMinutes: 180 }],
      "sick",
      [{ date: "2026-07-20", expectedMinutes: 540 }],
    );
    expect(value).toBeCloseTo(1 / 3);
  });

  it("uses a personal shortened-day exception when calculating usage", () => {
    const result = calculateLeaveBalances({
      asOf: "2026-07-20",
      adjustments: [{ leaveType: "sick", minutes: 1_000 }],
      leaves: [{ leaveType: "sick", startDate: "2026-07-20", endDate: "2026-07-20", partialMinutes: null }],
      schedules: schedule,
      exceptions: [{ date: "2026-07-20", type: "shortened", targetMinutes: 360 }],
      rules: [],
    });
    expect(result.sick).toBe(640);
  });
});