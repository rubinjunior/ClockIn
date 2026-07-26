import { fromZonedTime } from "date-fns-tz";

export function monthUtcRange(month: string, timezone = "Asia/Jerusalem") {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("invalid_month");
  const nextMonth = new Date(month + "-01T12:00:00Z");
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return {
    startsAt: fromZonedTime(month + "-01T00:00:00", timezone).toISOString(),
    endsAt: fromZonedTime(nextMonth.toISOString().slice(0, 7) + "-01T00:00:00", timezone).toISOString(),
  };
}
