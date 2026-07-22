export type CompensationTerm = {
  effectiveFrom: string;
  effectiveTo: string | null;
  enabled: boolean;
  mode: "hidden" | "hourly" | "global";
  hourlyRate: number | null;
  monthlySalary: number | null;
};

export type CompensationDay = {
  date: string;
  workedMinutes: number;
  creditedAbsenceMinutes: number;
  future: boolean;
};

export type CompensationEstimate = {
  visible: boolean;
  amount: number;
  mode: "hourly" | "global" | "mixed" | "hidden";
};

function activeTerm(terms: CompensationTerm[], date: string) {
  return terms.find((term) => term.effectiveFrom <= date && (!term.effectiveTo || term.effectiveTo >= date));
}

function daysInMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function estimateMonthlyCompensation(days: CompensationDay[], terms: CompensationTerm[], includeFuture: boolean): CompensationEstimate {
  const activeModes = new Set<"hourly" | "global">();
  let amount = 0;

  for (const day of days) {
    const term = activeTerm(terms, day.date);
    if (!term?.enabled || term.mode === "hidden") continue;
    activeModes.add(term.mode);

    if (term.mode === "hourly") {
      const payableMinutes = day.workedMinutes + day.creditedAbsenceMinutes;
      amount += payableMinutes / 60 * (term.hourlyRate ?? 0);
    } else if (includeFuture || !day.future) {
      amount += (term.monthlySalary ?? 0) / daysInMonth(day.date);
    }
  }

  const mode = activeModes.size > 1 ? "mixed" : activeModes.values().next().value ?? "hidden";
  return { visible: activeModes.size > 0, amount: Math.round(amount * 100) / 100, mode };
}
