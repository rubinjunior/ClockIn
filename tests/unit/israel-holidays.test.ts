import { describe, expect, it } from "vitest";
import { classifyIsraelHolidays } from "@/lib/holidays/israel";
import { applyIsraelCalendar } from "@/lib/reports/israel-calendar";

const baseDay = { expectedMinutes: 540, workedMinutes: 0, creditedAbsenceMinutes: 0, manualAdjustmentMinutes: 0, finalBalanceMinutes: -540, missingMinutes: 540, overtimeMinutes: 0, sessions: 0, future: false, holidayLabel: null, shortenedDay: false };

describe("Israel holiday calendar", () => {
  it("marks statutory holidays and derives shortened holiday eves", () => {
    const rules = classifyIsraelHolidays([
      { title: "Erev Rosh Hashana", date: "2026-09-11" },
      { title: "Rosh Hashana 5787", date: "2026-09-12" },
      { title: "Rosh Hashana II", date: "2026-09-13" },
      { title: "Yom Kippur", date: "2026-09-21" },
      { title: "Purim", date: "2026-03-03" },
    ]);
    expect(rules).toContainEqual({ date: "2026-09-11", name: "ערב ראש השנה", type: "shortened", targetMinutes: 480 });
    expect(rules).toContainEqual({ date: "2026-09-12", name: "ראש השנה", type: "holiday", targetMinutes: 0 });
    expect(rules).toContainEqual({ date: "2026-09-13", name: "ראש השנה", type: "holiday", targetMinutes: 0 });
    expect(rules).toContainEqual({ date: "2026-09-20", name: "ערב יום כיפור", type: "shortened", targetMinutes: 360 });
    expect(rules.some((rule) => rule.date === "2026-03-03")).toBe(false);
  });

  it("keeps actual work at zero for future days and adjusts legal targets", () => {
    const rules = [{ date: "2026-09-11", name: "ערב ראש השנה", type: "shortened" as const, targetMinutes: 480 }];
    const [past] = applyIsraelCalendar([{ ...baseDay, date: "2026-09-11" }], rules, false);
    expect(past.expectedMinutes).toBe(480);
    expect(past.workedMinutes).toBe(0);
    expect(past.missingMinutes).toBe(480);
    const [future] = applyIsraelCalendar([{ ...baseDay, date: "2026-09-11", workedMinutes: 1440, future: true }], rules, false);
    expect(future.expectedMinutes).toBe(0);
    expect(future.workedMinutes).toBe(0);
    expect(future.finalBalanceMinutes).toBe(0);
  });
  it("does not count the current day as missing while it is still in progress", () => {
    const [today] = applyIsraelCalendar([{ ...baseDay, date: "2026-07-22", provisional: true }], [], false);
    expect(today.finalBalanceMinutes).toBe(-540);
    expect(today.missingMinutes).toBe(0);
  });
  it("does not confuse Rosh Hashana LaBehemot with the statutory new year", () => {
    expect(classifyIsraelHolidays([{ title: "Rosh Hashana LaBehemot", date: "2026-08-14" }])).toEqual([]);
  });
});