import { ADMIN_REFERENCE_TIMEZONE } from "@/lib/date-time/constants";

export function getBusinessDate(instant: Date = new Date()): string {
  return getLocalWorkDate(instant, ADMIN_REFERENCE_TIMEZONE);
}

export function formatBusinessDate(workDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${workDate}T00:00:00.000Z`));
}

/** Intl validates named IANA zones; numeric UTC offsets are not event zones. */
export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 100 || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function getLocalWorkDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatEventTime(instant: string, timeZone: string): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(instant))} (${timeZone})`;
}

export function formatAdminEventTime(instant: string, timeZone: string, clockOnly = false): string {
  const labels: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };
  const label = labels[timeZone];
  if (clockOnly) return `${new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit",
  }).format(new Date(instant))} ${label ?? timeZone}`;
  const formatted = formatEventTime(instant, timeZone);
  return label ? `${formatted} · ${label}` : formatted;
}
