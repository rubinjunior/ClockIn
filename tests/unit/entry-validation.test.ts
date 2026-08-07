import { afterEach, describe, expect, it, vi } from "vitest";
import { timeEntrySchema } from "@/lib/validation/schemas";

function entry(clockIn: string, clockOut: string) { return { clockIn, clockOut, categoryId: "", note: "", reason: "בדיקה" }; }

describe("time entry validation", () => {
  afterEach(() => vi.useRealTimers());

  it("accepts future hours inside the current Israel date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T06:00:00.000Z"));

    const result = timeEntrySchema.safeParse(entry(
      "2026-08-07T14:00:00.000Z",
      "2026-08-07T15:00:00.000Z",
    ));

    expect(result.success).toBe(true);
  });

  it("rejects reports on a future Israel date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T06:00:00.000Z"));

    const result = timeEntrySchema.safeParse(entry(
      "2026-08-08T06:00:00.000Z",
      "2026-08-08T07:00:00.000Z",
    ));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message === "לא ניתן להזין דיווח ליום עתידי")).toBe(true);
  });

  it("rejects zero and negative duration reports", () => {
    const start = new Date(Date.now() - 7_200_000);
    expect(timeEntrySchema.safeParse(entry(start.toISOString(), start.toISOString())).success).toBe(false);
    expect(timeEntrySchema.safeParse(entry(start.toISOString(), new Date(start.getTime() - 60_000).toISOString())).success).toBe(false);
  });

  it("accepts a completed past report", () => {
    const end = new Date(Date.now() - 60_000);
    const start = new Date(end.getTime() - 3_600_000);
    expect(timeEntrySchema.safeParse(entry(start.toISOString(), end.toISOString())).success).toBe(true);
  });
});