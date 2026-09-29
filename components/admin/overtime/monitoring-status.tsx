export function OvertimeMonitoringStatus({ state }: { state: string }) {
  const color = state === "Completed" || state === "Authorized" ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
    : state === "In Progress" || state === "Activity Started" ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${color}`}>{state}</span>;
}
