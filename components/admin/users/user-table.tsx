import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { ListUsersInput } from "@/schemas/user.schema";
import { UserStatusAction } from "@/components/admin/users/user-status-action";
import { UserFormDialog } from "@/components/admin/users/user-form-dialog";
import type { UserDto } from "@/types/user";
import type { WorkScheduleOption } from "@/types/work-schedule";

type UsersTableQuery = Pick<ListUsersInput, "search" | "role" | "pageSize" | "sort" | "order"> & { status: string };

export function UserTable({ users, schedules, adminId, query, page }: { users: UserDto[]; schedules: WorkScheduleOption[]; adminId: string; query: UsersTableQuery; page: number }) {
  function header(field: NonNullable<ListUsersInput["sort"]>, label: string, className?: string) {
    const active = query.sort === field && !!query.order;
    const nextOrder = active && query.order === "asc" ? "desc" : "asc";
    const Icon = active ? query.order === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    params.set("sort", field); params.set("order", nextOrder); params.set("page", "1");
    return <th scope="col" className={className} aria-sort={active ? query.order === "asc" ? "ascending" : "descending" : "none"}>
      <Link href={`/admin/users?${params}`} scroll={false} className="inline-flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Sort ${label} ${nextOrder === "asc" ? "ascending" : "descending"}`}>
        {label}<Icon aria-hidden="true" className="size-3.5 shrink-0" />
      </Link>
    </th>;
  }
  return <div className="max-w-full overflow-x-auto rounded-xl border bg-card" role="region" aria-label="Users" tabIndex={0}>
    <table className="w-full text-left text-sm [&_th]:border-b [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-medium [&_td]:border-b [&_td]:px-3 [&_td]:py-1.5 [&_tr:last-child_td]:border-0">
    <thead><tr><th scope="col" className="w-10 text-right text-muted-foreground">No.</th>{header("name", "Employee")}{header("email", "Email", "hidden sm:table-cell")}{header("position", "Position", "hidden md:table-cell")}{header("status", "Status")}<th scope="col">Actions</th></tr></thead>
    <tbody>{users.map((user, rowIndex) => <tr key={user.id}>
      <td className="w-10 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">{(page - 1) * query.pageSize + rowIndex + 1}</td>
      <td className="max-w-56 break-words font-medium">{user.name}{user.role === "ADMIN" && <span className="ml-2 text-[10px] font-normal text-muted-foreground">ADMIN</span>}</td>
      <td className="hidden max-w-64 break-all text-muted-foreground sm:table-cell">{user.email}</td>
      <td className="hidden max-w-48 break-words text-muted-foreground md:table-cell">{user.position || "—"}</td>
      <td><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${user.isActive ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200" : "bg-muted text-muted-foreground"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
      <td><div className="flex items-start gap-0.5"><UserFormDialog user={user} schedules={schedules} /><UserStatusAction id={user.id} name={user.name} isActive={user.isActive} isSelf={adminId === user.id} /></div></td>
    </tr>)}{!users.length && <tr><td colSpan={6}>No users match these filters.</td></tr>}</tbody>
    </table>
  </div>;
}
