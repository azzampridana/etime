import Link from "next/link";
import { OvertimeSortHeader, overtimeTableClass } from "@/components/admin/overtime/monitoring-table-header";
import { OvertimeMonitoringStatus } from "@/components/admin/overtime/monitoring-status";
import { AuthorizationControls } from "@/components/admin/overtime/authorization-controls";
import type { AuthorizationMonitoringSummary } from "@/types/admin-overtime-monitoring";
import type { OvertimeAuthorizationMonitoringQuery } from "@/schemas/admin-overtime-monitoring.schema";

export function AuthorizationTable({ items, query }: { items: AuthorizationMonitoringSummary[]; query: OvertimeAuthorizationMonitoringQuery }) {
  const urlQuery = { ...query, view: "authorization" };
  return <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border bg-card" role="region" aria-label="Overtime authorization" tabIndex={0}><table className={overtimeTableClass}>
    <thead><tr><th scope="col" className="w-10 text-right text-muted-foreground">No.</th><OvertimeSortHeader field="employee" label="Employee" query={urlQuery} /><OvertimeSortHeader field="date" label="Work Date" query={urlQuery} /><th scope="col" className="hidden md:table-cell">Attendance</th><OvertimeSortHeader field="status" label="Authorization" query={urlQuery} /><th scope="col">Actions</th></tr></thead>
    <tbody>{items.map((item, index) => <tr key={item.id} className="hover:bg-muted/30">
      <td className="text-right text-xs text-muted-foreground tabular-nums">{(query.page - 1) * query.pageSize + index + 1}</td>
      <td className="max-w-56 break-words"><p className="font-medium">{item.employee.name}</p>{item.employee.position && <p className="text-xs text-muted-foreground">{item.employee.position}</p>}</td>
      <td className="whitespace-nowrap">{item.workDate}</td><td className="hidden md:table-cell"><Link href={`/admin/attendance/${item.id}`} className="inline-flex min-h-10 items-center text-xs underline">Completed</Link></td>
      <td><OvertimeMonitoringStatus state={item.state} />{item.state === "Activity Started" && item.revoked && <p className="mt-1 text-xs text-muted-foreground">Authorization revoked</p>}</td>
      <td><AuthorizationControls item={item} compact canGrant={item.canGrant} /></td>
    </tr>)}{!items.length && <tr><td colSpan={6} className="text-muted-foreground">No matching authorization records or eligible completed attendance.</td></tr>}</tbody>
  </table></div>;
}
