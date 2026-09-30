import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OvertimeActivityQuery, OvertimeAuthorizationMonitoringQuery } from "@/schemas/admin-overtime-monitoring.schema";

export function OvertimeMonitoringFilters({ input, authorization = false }: { input: OvertimeActivityQuery | OvertimeAuthorizationMonitoringQuery; authorization?: boolean }) {
  const states = authorization ? [["all", "All"], ["not-authorized", "Not Authorized"], ["authorized", "Authorized"], ["revoked", "Revoked"], ["used", "Activity Started"]] : [["all", "All"], ["open", "In Progress"], ["completed", "Completed"], ["incomplete", "Incomplete"]];
  const path = authorization ? "/admin/overtime?view=authorization" : "/admin/overtime";
  return <form key={JSON.stringify(input)} action="/admin/overtime" className="mb-4 flex flex-wrap items-end gap-3">
    {authorization && <input type="hidden" name="view" value="authorization" />}
    <input type="hidden" name="page" value="1" /><input type="hidden" name="pageSize" value={input.pageSize} />
    {input.sort && <input type="hidden" name="sort" value={input.sort} />}{input.order && <input type="hidden" name="order" value={input.order} />}
    {input.userId && <input type="hidden" name="userId" value={input.userId} />}
    <label className="min-w-40 flex-1 space-y-1 text-sm">Search<Input name="search" defaultValue={input.search} placeholder="Search employee…" className="h-10" /></label>
    <label className="space-y-1 text-sm">From<Input type="date" name="from" defaultValue={input.from} required className="h-10" /></label>
    <label className="space-y-1 text-sm">To<Input type="date" name="to" defaultValue={input.to} required className="h-10" /></label>
    <label className="space-y-1 text-sm">Status<select name="state" defaultValue={input.state} className="block h-10 rounded-lg border bg-background px-2">{states.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <Button type="submit" className="h-10">Apply</Button><Link href={path} className="inline-flex h-10 items-center text-sm underline">Reset</Link>
  </form>;
}
