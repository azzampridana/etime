// Display only: callers supply the authoritative duration in minutes.
export function formatDurationMinutes(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError("Duration must be a non-negative integer number of minutes.");
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  return remainder ? `${hours}h ${String(remainder).padStart(2, "0")}m` : `${hours}h`;
}

export function formatSignedDurationMinutes(minutes: number): string {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
  return `${sign}${formatDurationMinutes(Math.abs(minutes))}`;
}
