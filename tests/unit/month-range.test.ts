import { describe, expect, it } from "vitest";
import { monthUtcRange } from "@/lib/time/month-range";

describe("גבולות חודש לפי שעון ישראל", () => {
  it("מחשב את שעון הקיץ בלי להעביר דיווחים לחודש אחר", () => {
    expect(monthUtcRange("2026-07")).toEqual({
      startsAt: "2026-06-30T21:00:00.000Z",
      endsAt: "2026-07-31T21:00:00.000Z",
    });
  });

  it("מחשב את שעון החורף לפי ההיסט האמיתי", () => {
    expect(monthUtcRange("2026-12")).toEqual({
      startsAt: "2026-11-30T22:00:00.000Z",
      endsAt: "2026-12-31T22:00:00.000Z",
    });
  });
});
