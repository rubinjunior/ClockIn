import { splitSessionByLocalDate } from "@/lib/time/calculations";

export type CategorizedSession = {
  clockIn: string;
  clockOut: string | null;
  categoryId: string | null;
};

export function summarizeCategorizedSessions(entries: CategorizedSession[], timezone: string, startDate: string, endDate: string) {
  const totals: Record<string, number> = {};
  const byDate: Record<string, Record<string, number>> = {};

  for (const entry of entries) {
    if (!entry.categoryId || !entry.clockOut) continue;
    const segments = splitSessionByLocalDate(entry, timezone);
    for (const [date, minutes] of Object.entries(segments)) {
      if (date < startDate || date > endDate) continue;
      totals[entry.categoryId] = (totals[entry.categoryId] ?? 0) + minutes;
      byDate[date] ??= {};
      byDate[date][entry.categoryId] = (byDate[date][entry.categoryId] ?? 0) + minutes;
    }
  }

  return { totals, byDate };
}