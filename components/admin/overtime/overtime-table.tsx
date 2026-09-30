import { OvertimeSortHeader, overtimeTableClass } from "@/components/admin/overtime/monitoring-table-header";
import { OvertimeMonitoringStatus } from "@/components/admin/overtime/monitoring-status";
import { OvertimeDetailDialog } from "@/components/admin/overtime/overtime-detail-dialog";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import type { OvertimeActivitySummary } from "@/types/admin-overtime-monitoring";
import type { OvertimeActivityQuery } from "@/schemas/admin-overtime-monitoring.schema";

export function OvertimeTable({ items, query, today }: { items: OvertimeActivitySummary[]; query: OvertimeActivityQuery; today: boolean }) {
  return <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border bg-card" role="region" aria-label="Overtime activity" tabIndex={0}><table className={overtimeTableClass}>
    <thead><tr><th scope="col" className="w-10 text-right text-muted-foreground">No.</th>
      <OvertimeSortHeader field="employee" label="Employee" query={query} /><OvertimeSortHeader field="date" label="Work Date" query={query} />
      <OvertimeSortHeader field="checkIn" label="Check In" query={query} className="hidden md:table-cell" /><OvertimeSortHeader field="checkOut" label="Check Out" query={query} className="hidden md:table-cell" />
      <OvertimeSortHeader field="duration" label="Duration" query={query} className="hidden sm:table-cell" /><OvertimeSortHeader field="status" label="Status" query={query} /><th scope="col">Actions</th>
    </tr></thead>
    <tbody>{items.map((item, index) => <tr key={item.id} className="hover:bg-muted/30">
      <td className="text-right text-xs text-muted-foreground tabular-nums">{(query.page - 1) * query.pageSize + index + 1}</td>
      <td className="max-w-56 break-words"><p className="font-medium">{item.employee.name}</p>{item.employee.position && <p className="text-xs text-muted-foreground">{item.employee.position}</p>}</td>
      <td className="whitespace-nowrap">{item.workDate}</td>
      <td className="hidden whitespace-nowrap md:table-cell">{formatAdminEventTime(item.checkIn.at, item.checkIn.timezone, true)}</td>
      <td className="hidden whitespace-nowrap md:table-cell">{item.checkOut ? formatAdminEventTime(item.checkOut.at, item.checkOut.timezone, true) : item.state === "Incomplete" ? "Missing Checkout" : "—"}</td>
      <td className="hidden whitespace-nowrap sm:table-cell">{item.durationMinutes === null ? "—" : formatDurationMinutes(item.durationMinutes)}</td>
      <td><OvertimeMonitoringStatus state={item.state} /></td><td><OvertimeDetailDialog id={item.id} name={item.employee.name} /></td>
    </tr>)}{!items.length && <tr><td colSpan={8} className="text-muted-foreground">{today && query.state === "all" && !query.search && !query.userId && query.page === 1 ? "No overtime activity recorded for today." : "No overtime activity matches these filters."}</td></tr>}</tbody>
  </table></div>;
}
