import Link from "next/link";
import { requirePageUser } from "@/lib/authorization/page-access";
import { listAdminCorrections } from "@/services/admin-attendance-correction.service";
import { adminCorrectionQuerySchema } from "@/schemas/attendance-correction.schema";
import { PageHeading } from "@/components/shared/page-heading";
import { InvalidFilters } from "@/components/admin/invalid-filters";
import { Pagination } from "@/components/admin/pagination";
import { formatAdminEventTime } from "@/lib/date-time/event-time";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser(true);
  const parsed = adminCorrectionQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <><PageHeading title="Attendance Requests" /><InvalidFilters path="/admin/attendance-requests" /></>;
  const result = await listAdminCorrections(parsed.data);
  return <>
    <PageHeading title="Attendance Requests" description="Review immutable historical attendance proposals. Times below use Asia/Jakarta." />
    <nav aria-label="Request status" className="mb-4 flex flex-wrap gap-2">
      {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map(status => <Link key={status} href={`/admin/attendance-requests?status=${status}`} aria-current={status === result.status ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm ${status === result.status ? "bg-teal-50 font-semibold text-teal-900" : "bg-card"}`}>{status}</Link>)}
    </nav>
    {!result.items.length ? <p className="rounded-xl border bg-card p-5 text-sm">No requests match this status on this page.</p> : <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-left text-sm"><caption className="sr-only">Attendance correction requests</caption>
        <thead className="bg-muted/50"><tr>{["Employee", "Work date / Type", "Status", "Submitted", "Decision / Reviewer", "Action"].map(label => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{result.items.map(row => <tr key={row.id} className="border-t align-top">
          <td className="p-3"><p className="font-medium">{row.employee.name}</p><p className="break-all text-xs text-muted-foreground">{row.employee.email}</p>{!row.employee.isActive && <p className="text-xs">Inactive</p>}</td>
          <td className="p-3"><p className="whitespace-nowrap">{row.workDate}</p><p>{row.type === "MISSING_BOTH" ? "Missing Attendance" : "Missing Checkout"}</p></td>
          <td className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{row.status}</span></td>
          <td className="p-3">{formatAdminEventTime(row.submittedAt, "Asia/Jakarta")}</td>
          <td className="p-3">{row.reviewedAt ? formatAdminEventTime(row.reviewedAt, "Asia/Jakarta") : "Not reviewed"}{row.reviewer && <p>{row.reviewer}</p>}</td>
          <td className="p-3"><Link className="inline-flex min-h-11 items-center underline" href={`/admin/attendance-requests/${row.id}?status=${result.status}&page=${result.page}`}>View</Link></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <Pagination path="/admin/attendance-requests" query={{ status: result.status }} {...result} compact />
  </>;
}
