import { describe, expect, it } from "vitest";
import { completedWorkedMinutes } from "@/lib/reports/worked-minutes";

describe("completed report minutes", () => {
  it("returns zero when either endpoint is missing", () => {
    expect(completedWorkedMinutes(1440, null, null)).toBe(0);
    expect(completedWorkedMinutes(1440, "2026-07-27T06:00:00Z", null)).toBe(0);
    expect(completedWorkedMinutes(1440, null, "2026-07-27T15:00:00Z")).toBe(0);
  });

  it("keeps worked minutes only for a valid completed range", () => {
    expect(completedWorkedMinutes(510, "2026-07-27T06:00:00Z", "2026-07-27T14:30:00Z")).toBe(510);
    expect(completedWorkedMinutes(510, "2026-07-27T15:00:00Z", "2026-07-27T06:00:00Z")).toBe(0);
  });
});
