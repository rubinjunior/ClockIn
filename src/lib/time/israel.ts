import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

export function israelToday(value: Date = new Date()) {
  return formatInTimeZone(value, DEFAULT_TIMEZONE, "yyyy-MM-dd");
}

export function israelMonth(value: Date = new Date()) {
  return formatInTimeZone(value, DEFAULT_TIMEZONE, "yyyy-MM");
}
