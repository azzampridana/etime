import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { AttendanceDetailDialog } from "@/components/admin/attendance/attendance-detail-dialog";
import { AttendanceStatus } from "@/components/admin/attendance/attendance-status";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import type { AdminAttendanceSummaryDto } from "@/types/admin-attendance";
import type { AdminAttendanceMonitoringQuery } from "@/schemas/admin-query.schema";

export function AttendanceTable({ items, query }: { items: AdminAttendanceSummaryDto[]; query: AdminAttendanceMonitoringQuery }) {
  function header(field: NonNullable<AdminAttendanceMonitoringQuery["sort"]>, label: string, className?: string) {
    const active = query.sort === field && !!query.order;
    const nextOrder = active && query.order === "asc" ? "desc" : "asc";
    const Icon = active ? query.order === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    params.set("sort", field); params.set("order", nextOrder); params.set("page", "1");
    return <th scope="col" className={className} aria-sort={active ? query.order === "asc" ? "ascending" : "descending" : "none"}>
      <Link href={`/admin/attendance?${params}`} scroll={false} className="inline-flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Sort ${label} ${nextOrder === "asc" ? "ascending" : "descending"}`}>
        {label}<Icon aria-hidden="true" className="size-3.5 shrink-0" />
      </Link>
    </th>;
  }
  return <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border bg-card" role="region" aria-label="Regular attendance" tabIndex={0}>
    <table className="w-full text-left text-sm [&_th]:border-b [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-medium [&_td]:border-b [&_td]:px-3 [&_td]:py-1.5 [&_tr:last-child_td]:border-0">
      <thead><tr><th scope="col" className="w-10 text-right text-muted-foreground">No.</th>{header("employee", "Employee")}{header("date", "Date")}{header("checkIn", "Check In", "hidden md:table-cell")}{header("checkOut", "Check Out", "hidden md:table-cell")}{header("status", "Status")}<th scope="col">Actions</th></tr></thead>
      <tbody>{items.map((item, index) => <tr key={item.id} className="hover:bg-muted/30">
        <td className="w-10 whitespace-nowrap text-right text-xs text-muted-foreground tabular-nums">{(query.page - 1) * query.pageSize + index + 1}</td>
        <td className="max-w-56 break-words"><p className="font-medium">{item.employee.name}</p>{item.employee.position && <p className="text-xs text-muted-foreground">{item.employee.position}</p>}</td>
        <td className="whitespace-nowrap tabular-nums">{item.workDate}</td>
        <td className="hidden whitespace-nowrap md:table-cell">{formatAdminEventTime(item.checkInAt, item.checkInTimezone, true)}</td>
        <td className="hidden whitespace-nowrap md:table-cell">{item.checkOutAt && item.checkOutTimezone ? formatAdminEventTime(item.checkOutAt, item.checkOutTimezone, true) : "—"}</td>
        <td><AttendanceStatus state={item.state} /></td>
        <td><AttendanceDetailDialog id={item.id} name={item.employee.name} /></td>
      </tr>)}{!items.length && <tr><td colSpan={7} className="text-muted-foreground">No attendance records match these filters.</td></tr>}</tbody>
    </table>
  </div>;
}
