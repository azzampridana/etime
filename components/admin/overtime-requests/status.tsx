export function OvertimeRequestStatus({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const color = status === "APPROVED" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : status === "REJECTED" ? "bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-current/10 ${color}`}>{status}</span>;
}
