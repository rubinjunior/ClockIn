import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("monthly report migration", () => {
  it("includes completed entries from the current day even when their time is later today", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608070002_include_same_day_future_entries_in_report.sql"),
      "utf8",
    );

    expect(sql).not.toContain("e.clock_in <= now()");
    expect(sql).not.toContain("e.clock_out <= now()");
    expect(sql).toContain("c.work_date > (now() at time zone c.timezone)::date is_future");
  });
});
