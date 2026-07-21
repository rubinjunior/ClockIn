import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/lib/constants";

export function formatMinutes(total: number): string {
  const sign = total < 0 ? "−" : "";
  const absolute = Math.abs(Math.round(total));
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatLocalDate(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone: DEFAULT_TIMEZONE, dateStyle: "long", ...options }).format(new Date(value));
}

export function formatTime(value: Date | string, timezone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function formatCurrency(value: number, currency = "ILS"): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
