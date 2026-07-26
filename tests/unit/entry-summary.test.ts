import { describe, expect, it } from "vitest";
import { summarizeEntriesByDay } from "@/lib/entries/entry-summary";

describe("entries monthly summary", () => {
  it("groups by the Israeli local date and counts integer minutes", () => {
    const result = summarizeEntriesByDay(
      [
        {
          id: "late",
          clock_in: "2026-07-01T21:30:00.000Z",
          clock_out: "2026-07-01T22:30:00.000Z",
        },
        {
          id: "morning",
          clock_in: "2026-07-02T06:00:00.000Z",
          clock_out: "2026-07-02T07:15:00.000Z",
        },
      ],
      "Asia/Jerusalem",
    );

    expect(result.days).toHaveLength(1);
    expect(result.days[0]?.date).toBe("2026-07-02");
    expect(result.days[0]?.minutes).toBe(135);
    expect(result.totalMinutes).toBe(135);
  });

  it("marks open entries without adding fabricated work time", () => {
    const result = summarizeEntriesByDay(
      [{ clock_in: "2026-07-02T06:00:00.000Z", clock_out: null }],
      "Asia/Jerusalem",
    );

    expect(result.openEntries).toBe(1);
    expect(result.totalMinutes).toBe(0);
    expect(result.days[0]?.minutes).toBe(0);
  });
});
