import { formatInTimeZone } from "date-fns-tz";

export type SummarizableEntry = {
  clock_in: string;
  clock_out: string | null;
};

export type EntryDay<T extends SummarizableEntry> = {
  date: string;
  entries: T[];
  minutes: number;
};

export function summarizeEntriesByDay<T extends SummarizableEntry>(
  entries: T[],
  timezone: string,
) {
  const dayMap = new Map<string, EntryDay<T>>();
  let totalMinutes = 0;
  let openEntries = 0;

  for (const entry of entries) {
    const date = formatInTimeZone(entry.clock_in, timezone, "yyyy-MM-dd");
    const minutes = entry.clock_out
      ? Math.max(
          0,
          Math.round(
            (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) /
              60_000,
          ),
        )
      : 0;
    const day = dayMap.get(date) ?? { date, entries: [], minutes: 0 };
    day.entries.push(entry);
    day.minutes += minutes;
    dayMap.set(date, day);
    totalMinutes += minutes;
    if (!entry.clock_out) openEntries += 1;
  }

  return {
    days: [...dayMap.values()],
    totalMinutes,
    openEntries,
  };
}
