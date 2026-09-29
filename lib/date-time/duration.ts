/** Whole elapsed minutes, truncated only for display/DTO; persisted timestamps are untouched. */
export function elapsedWholeMinutes(start: Date, end: Date): number {
  const milliseconds = end.getTime() - start.getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError("Invalid attendance interval.");
  return Math.floor(milliseconds / 60_000);
}
