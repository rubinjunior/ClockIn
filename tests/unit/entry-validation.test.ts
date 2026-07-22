import { describe, expect, it } from "vitest";
import { timeEntrySchema } from "@/lib/validation/schemas";

function entry(clockIn: string, clockOut: string) { return { clockIn, clockOut, categoryId: "", note: "", reason: "בדיקה" }; }

describe("time entry validation", () => {
  it("rejects future reports", () => {
    const future = new Date(Date.now() + 3_600_000);
    const end = new Date(future.getTime() + 3_600_000);
    const result = timeEntrySchema.safeParse(entry(future.toISOString(), end.toISOString()));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message === "לא ניתן להזין שעות עתידיות")).toBe(true);
  });

  it("accepts a completed past report", () => {
    const end = new Date(Date.now() - 60_000);
    const start = new Date(end.getTime() - 3_600_000);
    expect(timeEntrySchema.safeParse(entry(start.toISOString(), end.toISOString())).success).toBe(true);
  });
});