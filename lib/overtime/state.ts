/** Absolute server-time policy; independent of work date and event timezone. */
export const DEFAULT_OVERTIME_MAX_OPEN_MINUTES = 720;

export function getOvertimeState(session: { checkInAt: Date; checkOutAt: Date | null; maxOpenMinutes: number }, now: Date): "Open" | "Completed" | "Incomplete" {
  if (session.checkOutAt !== null) return "Completed";
  return now.getTime() - session.checkInAt.getTime() > session.maxOpenMinutes * 60_000 ? "Incomplete" : "Open";
}
