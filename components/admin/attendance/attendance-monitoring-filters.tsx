import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminAttendanceMonitoringQuery } from "@/schemas/admin-query.schema";

export function AttendanceMonitoringFilters({ input }: { input: AdminAttendanceMonitoringQuery }) {
  return <form key={JSON.stringify(input)} action="/admin/attendance" className="mb-4 flex flex-wrap items-end gap-3">
    <input type="hidden" name="page" value="1" />
    <input type="hidden" name="pageSize" value={input.pageSize} />
    {input.sort && <input type="hidden" name="sort" value={input.sort} />}
    {input.order && <input type="hidden" name="order" value={input.order} />}
    {input.userId && <input type="hidden" name="userId" value={input.userId} />}
    <label className="min-w-40 flex-1 space-y-1 text-sm">Search<Input name="search" defaultValue={input.search} placeholder="Search employee…" className="h-10" /></label>
    <label className="space-y-1 text-sm">From<Input type="date" name="from" defaultValue={input.from} required className="h-10" /></label>
    <label className="space-y-1 text-sm">To<Input type="date" name="to" defaultValue={input.to} required className="h-10" /></label>
    <label className="space-y-1 text-sm">Status<select name="state" defaultValue={input.state} className="block h-10 rounded-lg border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring">{["all", "working", "completed", "incomplete"].map(state => <option key={state} value={state}>{state[0].toUpperCase() + state.slice(1)}</option>)}</select></label>
    <Button type="submit" className="h-10">Apply</Button>
    <Link href="/admin/attendance" className="inline-flex h-10 items-center text-sm underline">Reset</Link>
  </form>;
}
