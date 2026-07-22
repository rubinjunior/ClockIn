export type HebcalHolidayItem = { title: string; date: string; category?: string };
export type IsraelCalendarRule = { date: string; name: string; type: "holiday" | "shortened"; targetMinutes: number };

const holidayNames: Array<{ match: (title: string) => boolean; name: string }> = [
  { match: (title) => /^Rosh Hashana (?:\d{4}|II)$/.test(title), name: "ראש השנה" },
  { match: (title) => title === "Yom Kippur", name: "יום כיפור" },
  { match: (title) => title === "Sukkot I", name: "היום הראשון של סוכות" },
  { match: (title) => title === "Shmini Atzeret", name: "שמיני עצרת ושמחת תורה" },
  { match: (title) => title === "Pesach I", name: "היום הראשון של פסח" },
  { match: (title) => title === "Pesach VII", name: "שביעי של פסח" },
  { match: (title) => title === "Shavuot", name: "שבועות" },
  { match: (title) => title.startsWith("Yom HaAtzma"), name: "יום העצמאות" },
];

function previousDate(date: string) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function classifyIsraelHolidays(items: HebcalHolidayItem[]): IsraelCalendarRule[] {
  const holidays = items.flatMap((item) => {
    const match = holidayNames.find((candidate) => candidate.match(item.title));
    return match ? [{ date: item.date.slice(0, 10), name: match.name, type: "holiday" as const, targetMinutes: 0 }] : [];
  });
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const shortened = holidays.flatMap((holiday) => {
    const date = previousDate(holiday.date);
    if (holidayDates.has(date)) return [];
    return [{ date, name: "ערב " + holiday.name, type: "shortened" as const, targetMinutes: holiday.name === "יום כיפור" ? 360 : 480 }];
  });
  return [...holidays, ...shortened].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getIsraelCalendarRules(year: number): Promise<IsraelCalendarRule[]> {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return [];
  try {
    const query = new URLSearchParams({ v: "1", cfg: "json", year: String(year), maj: "on", mod: "on", i: "on", lg: "en" });
    const response = await fetch("https://www.hebcal.com/hebcal?" + query, { next: { revalidate: 86_400 } });
    if (!response.ok) throw new Error("hebcal_http_" + response.status);
    const payload = await response.json() as { items?: HebcalHolidayItem[] };
    return classifyIsraelHolidays(payload.items ?? []);
  } catch (error) {
    console.error("[israel-calendar]", error instanceof Error ? error.message : "fetch_failed");
    return [];
  }
}