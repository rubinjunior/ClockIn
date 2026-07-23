import { describe, expect, it } from "vitest";
import { summarizeCategorizedSessions } from "@/lib/reports/category-summary";

describe("סיכומי קטגוריות", () => {
  it("מסכם קטגוריה בלי להכפיל את שעות העבודה", () => {
    const result = summarizeCategorizedSessions([
      { clockIn: "2026-07-20T06:00:00Z", clockOut: "2026-07-20T14:00:00Z", categoryId: "home" },
      { clockIn: "2026-07-21T06:00:00Z", clockOut: "2026-07-21T08:00:00Z", categoryId: null },
    ], "Asia/Jerusalem", "2026-07-01", "2026-07-31");
    expect(result.totals).toEqual({ home: 480 });
    expect(result.dayCounts).toEqual({ home: 1 });
    expect(result.uncategorizedMinutes).toBe(120);
    expect(result.uncategorizedDays).toBe(1);
  });

  it("מפצל דיווח שחוצה חצות לפי אזור הזמן", () => {
    const result = summarizeCategorizedSessions([
      { clockIn: "2026-07-20T20:00:00Z", clockOut: "2026-07-20T23:00:00Z", categoryId: "night" },
    ], "Asia/Jerusalem", "2026-07-01", "2026-07-31");
    expect(result.byDate["2026-07-20"].night).toBe(60);
    expect(result.byDate["2026-07-21"].night).toBe(120);
    expect(result.totals.night).toBe(180);
  });
});
