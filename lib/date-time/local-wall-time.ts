import { isValidTimeZone } from "@/lib/date-time/event-time";
import { ApplicationError } from "@/lib/errors/application-error";

/** Minute-precision declared wall time. Never parsed in the host/browser timezone. */
export function localWallTimeToInstant(local: string, timezone: string): Date {
  const invalid = () => new ApplicationError("INVALID_LOCAL_TIME", "Enter a valid local date/time and IANA timezone.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !isValidTimeZone(timezone)) throw invalid();
  const wall = new Date(`${local}:00.000Z`);
  if (!Number.isFinite(wall.getTime()) || wall.getUTCFullYear() < 1 || wall.toISOString().slice(0, 16) !== local) throw invalid();
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, calendar: "gregory", numberingSystem: "latn",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const asWall = (at: number) => {
    const parts = formatter.formatToParts(new Date(at));
    const part = (key: string) => parts.find(item => item.type === key)!.value;
    return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
  };
  // Collect offsets on both sides of nearby transitions, including non-hour offsets.
  // Round-trip every candidate and reject folds/gaps rather than choosing an offset silently.
  const offsets = new Set<number>();
  for (let minutes = -36 * 60; minutes <= 36 * 60; minutes += 30) {
    const probe = wall.getTime() + minutes * 60_000;
    offsets.add(new Date(`${asWall(probe)}Z`).getTime() - probe);
  }
  const candidates = [...offsets].map(offset => wall.getTime() - offset)
    .filter(at => Number.isFinite(at) && asWall(at) === `${local}:00`);
  if (candidates.length !== 1) throw new ApplicationError("AMBIGUOUS_LOCAL_TIME", candidates.length
    ? "This local time occurs twice in the declared timezone. Contact an administrator; it cannot be submitted unambiguously."
    : "This local time does not exist in the declared timezone. Check the date, time and timezone.");
  return new Date(candidates[0]);
}
