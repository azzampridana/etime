import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { EmployeeReportDialog } from "@/components/admin/reports/employee-report-dialog";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import type { EmployeeReportSummary } from "@/types/report";
import type { EmployeeReportQuery } from "@/schemas/report.schema";

export function ReportTable({ items, query }: { items: EmployeeReportSummary[]; query: EmployeeReportQuery }) {
  function header(field: NonNullable<EmployeeReportQuery["sort"]>, label: string, className?: string) {
    const active = query.sort === field && !!query.order;
    const nextOrder = active && query.order === "asc" ? "desc" : "asc";
    const Icon = active ? query.order === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    params.set("sort", field); params.set("order", nextOrder); params.set("page", "1");
    return <th scope="col" className={className} aria-sort={active ? query.order === "asc" ? "ascending" : "descending" : "none"}>
      <Link href={`/admin/reports?${params}`} scroll={false} className="inline-flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Sort ${label} ${nextOrder === "asc" ? "ascending" : "descending"}`}>{label}<Icon aria-hidden="true" className="size-3.5 shrink-0" /></Link>
    </th>;
  }
  return <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border bg-card" role="region" aria-label="Employee reports" tabIndex={0}>
    <table className="w-full text-left text-sm [&_th]:border-b [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-medium [&_td]:border-b [&_td]:px-3 [&_td]:py-1.5 [&_tr:last-child_td]:border-0">
      <thead><tr><th scope="col" className="w-10 text-right text-muted-foreground">No.</th>{header("employee", "Employee")}{header("attendance", "Attendance")}{header("completed", "Completed", "hidden lg:table-cell")}{header("incomplete", "Incomplete", "hidden lg:table-cell")}{header("regular", "Regular Hours")}{header("average", "Avg Hours", "hidden lg:table-cell")}{header("overtime", "OT", "hidden md:table-cell")}{header("overtimeHours", "OT Hours")}<th scope="col">Actions</th></tr></thead>
      <tbody>{items.map((item, index) => <tr key={item.id} className="hover:bg-muted/30">
        <td className="text-right text-xs text-muted-foreground tabular-nums">{(query.page - 1) * query.pageSize + index + 1}</td>
        <td className="max-w-56 break-words"><p className="font-medium">{item.name}</p>{item.position && <p className="text-xs text-muted-foreground">{item.position}</p>}</td>
        <td className="tabular-nums">{item.attendance}</td><td className="hidden tabular-nums lg:table-cell">{item.completed}</td><td className="hidden tabular-nums lg:table-cell">{item.incomplete}</td>
        <td className="whitespace-nowrap">{formatDurationMinutes(item.regularMinutes)}</td><td className="hidden whitespace-nowrap lg:table-cell">{item.averageMinutes === null ? "—" : formatDurationMinutes(Math.round(item.averageMinutes))}</td>
        <td className="hidden tabular-nums md:table-cell">{item.overtimeSessions}</td><td className="whitespace-nowrap">{formatDurationMinutes(item.overtimeMinutes)}</td>
        <td><EmployeeReportDialog key={`${item.id}:${query.from}:${query.to}:${query.search ?? ""}`} id={item.id} name={item.name} filters={query} /></td>
      </tr>)}{!items.length && <tr><td colSpan={10} className="text-muted-foreground">No attendance records found for the selected period.</td></tr>}</tbody>
    </table>
  </div>;
}
