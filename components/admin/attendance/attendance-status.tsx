import type { AdminAttendanceState } from "@/types/admin-attendance";

export function AttendanceStatus({ state }: { state: AdminAttendanceState }) {
  const color = state === "Completed" ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
    : state === "Working" ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
    : "bg-muted text-muted-foreground";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${color}`}>{state ?? "—"}</span>;
}
