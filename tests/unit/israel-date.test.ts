import { describe, expect, it } from "vitest";
import { israelMonth, israelToday } from "@/lib/time/israel";

describe("Israel calendar date", () => {
  it("uses the Israel date after UTC midnight boundaries", () => {
    const instant = new Date("2026-07-31T21:30:00.000Z");
    expect(israelToday(instant)).toBe("2026-08-01");
    expect(israelMonth(instant)).toBe("2026-08");
  });
});