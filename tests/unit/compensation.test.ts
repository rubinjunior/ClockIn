import { describe, expect, it } from "vitest";
import { estimateMonthlyCompensation, type CompensationDay, type CompensationTerm } from "@/lib/reports/compensation";

const day = (date: string, values: Partial<CompensationDay> = {}): CompensationDay => ({
  date,
  workedMinutes: 0,
  creditedAbsenceMinutes: 0,
  future: false,
  ...values,
});

const term = (values: Partial<CompensationTerm> = {}): CompensationTerm => ({
  effectiveFrom: "2026-07-01",
  effectiveTo: null,
  enabled: true,
  mode: "hourly",
  hourlyRate: 60,
  monthlySalary: null,
  ...values,
});

describe("monthly compensation estimate", () => {
  it("pays hourly work and credited absence minutes", () => {
    const result = estimateMonthlyCompensation([day("2026-07-01", { workedMinutes: 480, creditedAbsenceMinutes: 60 })], [term()], false);
    expect(result).toEqual({ visible: true, amount: 540, mode: "hourly" });
  });

  it("prorates global salary to date and projects the full month", () => {
    const days = Array.from({ length: 31 }, (_, index) => day(`2026-07-${String(index + 1).padStart(2, "0")}`, { future: index >= 10 }));
    const global = term({ mode: "global", hourlyRate: null, monthlySalary: 31_000 });
    expect(estimateMonthlyCompensation(days, [global], false).amount).toBe(10_000);
    expect(estimateMonthlyCompensation(days, [global], true).amount).toBe(31_000);
  });

  it("uses the term effective on each day", () => {
    const terms = [
      term({ effectiveTo: "2026-07-15", hourlyRate: 60 }),
      term({ effectiveFrom: "2026-07-16", hourlyRate: 90 }),
    ];
    const result = estimateMonthlyCompensation([
      day("2026-07-10", { workedMinutes: 60 }),
      day("2026-07-20", { workedMinutes: 60 }),
    ], terms, false);
    expect(result.amount).toBe(150);
  });

  it("hides the summary when compensation is disabled", () => {
    expect(estimateMonthlyCompensation([day("2026-07-01")], [term({ enabled: false })], false)).toEqual({ visible: false, amount: 0, mode: "hidden" });
  });
});
