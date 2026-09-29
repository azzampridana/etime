import Link from "next/link";
import { UserFilter } from "@/components/admin/attendance/user-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminAttendanceQuery } from "@/schemas/admin-query.schema";

export function AttendanceFilters({ input, selected, path }: { input: AdminAttendanceQuery; selected?: { id: string; name: string; email: string }; path: string }) {
  return (
    <form method="get" className="mb-6 grid min-w-0 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
      {([['from', 'Date From'], ['to', 'Date To']] as const).map(([name, label]) => <div key={name} className="min-w-0 space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type="date" required defaultValue={input[name]} className="min-h-12 min-w-0" /></div>)}
      <div className="space-y-2"><Label htmlFor="state">State</Label><select id="state" name="state" defaultValue={input.state} className="min-h-12 w-full rounded-lg border bg-background px-3"><option value="all">All states</option><option value="open">Open</option><option value="completed">Completed</option></select></div>
      <div className="space-y-2"><Label htmlFor="pageSize">Per page</Label><select id="pageSize" name="pageSize" defaultValue={input.pageSize} className="min-h-12 w-full rounded-lg border bg-background px-3">{[5, 20, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></div>
      <UserFilter key={input.userId ?? "all"} selected={selected ? { id: selected.id, name: selected.name, email: selected.email } : undefined} />
      <div className="space-y-2"><Label htmlFor="search">Employee name or email</Label><Input id="search" name="search" defaultValue={input.search} className="min-h-12" /></div>
      <div className="flex items-end gap-4"><Button type="submit" className="min-h-12">Apply filters</Button><Link href={path} className="inline-flex min-h-12 items-center underline">Reset</Link></div>
    </form>
  );
}
