"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import type { EmployeeListInput } from "@/schemas/employee.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { toEmployeeSummary } from "@/mappers/employee.mapper";
import { request } from "./client-api";
import { EmployeeEditor as Editor } from "./profile-editor";
import { Pagination } from "@/components/admin/pagination";
import { UserPageSize } from "@/components/admin/users/user-page-size";
type Listing = { items: ReturnType<typeof toEmployeeSummary>[]; total: number; page: number; pageSize: number };
const rowStyles = {
  ACTIVE: "bg-white hover:bg-muted/40 dark:bg-card dark:hover:bg-muted/40",
  INACTIVE: "bg-red-50/70 hover:bg-red-100/60 dark:bg-red-950/20 dark:hover:bg-red-950/35",
  RESIGNED: "bg-amber-50/70 hover:bg-amber-100/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/35",
  TERMINATED: "bg-muted/50 hover:bg-muted/80",
} satisfies Record<ReturnType<typeof toEmployeeSummary>["employmentStatus"], string>;
const badgeStyles = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  INACTIVE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  RESIGNED: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  TERMINATED: "bg-secondary text-secondary-foreground",
} satisfies Record<ReturnType<typeof toEmployeeSummary>["employmentStatus"], string>;
export function EmployeeManagement({ query }: { query: EmployeeListInput }) {
  const router = useRouter();
  const { page, pageSize, sort, order } = query;
  const [search, setSearch] = useState(query.search);
  const [data, setData] = useState<Listing | null>(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null), [notice, setNotice] = useState("");
  function navigate(changes: Partial<EmployeeListInput>) {
    const next = { ...query, ...changes };
    router.replace(`/admin/employees?${new URLSearchParams({ search: next.search, page: String(next.page), pageSize: String(next.pageSize), sort: next.sort, order: next.order })}`, { scroll: false });
  }
  function toggleSort(field: EmployeeListInput["sort"]) {
    navigate({ sort: field, order: sort === field && order === "asc" ? "desc" : "asc", page: 1 });
  }
  function sortHeader(field: EmployeeListInput["sort"], label: string) {
    const active = sort === field, Icon = active ? order === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
    return <th scope="col" className="px-3 py-2" aria-sort={active ? order === "asc" ? "ascending" : "descending" : "none"}><button type="button" className="inline-flex min-h-9 items-center gap-1 rounded px-1 font-semibold focus-visible:outline-2 focus-visible:outline-ring" onClick={() => toggleSort(field)}>{label}<Icon className="size-3.5" aria-hidden="true" /></button></th>;
  }
  useEffect(() => {
    let live = true; setData(null); setError("");
    request<Listing>(`?${new URLSearchParams({ search: query.search, page: String(page), pageSize: String(pageSize), sort, order })}`).then(value => {
      if (!live) return;
      setData(value);
      if (value.page !== page) router.replace(`/admin/employees?${new URLSearchParams({ search: query.search, page: String(value.page), pageSize: String(pageSize), sort, order })}`, { scroll: false });
    }).catch(() => { if (live) setError("Employees tidak dapat dimuat. Periksa sesi dan coba lagi."); });
    return () => { live = false; };
  }, [query.search, page, pageSize, sort, order, revision, router]);
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap gap-2"><form className="flex min-w-0 flex-1 gap-2" onSubmit={e => { e.preventDefault(); navigate({ search: search.trim(), page: 1 }); setRevision(n => n + 1); }}><Input aria-label="Cari nama, employee number atau email akun" placeholder="Nama, employee number, email" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /><Button type="submit" variant="outline">Search</Button></form><Button onClick={() => { setNotice(""); setEditor({ id: null }); }}>Add Employee</Button></div>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <div className="flex flex-wrap items-center gap-2 sm:hidden"><label htmlFor="employee-sort" className="text-sm">Sort</label><select id="employee-sort" className="min-h-11 rounded-md border bg-background px-2 text-sm" value={sort} onChange={e => { const value = e.target.value; if (value === "name" || value === "position" || value === "status") navigate({ sort: value, order: "asc", page: 1 }); }}><option value="name">Name</option><option value="position">Position</option><option value="status">Status</option></select><Button variant="outline" className="min-h-11" onClick={() => toggleSort(sort)}>{order === "asc" ? "Ascending ↑" : "Descending ↓"}</Button></div>
    {error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>Muat ulang</Button></div> : !data ? <p role="status">Memuat Employees…</p> : <>
      <div role="region" aria-label="Employees" tabIndex={0} className="overflow-x-auto rounded-lg border bg-white dark:bg-card focus-visible:outline-2 focus-visible:outline-ring"><table className="w-full text-sm [&_td]:align-top max-sm:[&_tbody]:block max-sm:[&_tr]:grid max-sm:[&_tr]:grid-cols-2 max-sm:[&_td]:min-w-0 max-sm:[&_td:nth-child(2)]:col-span-2 max-sm:[&_td]:max-w-none"><thead className="bg-muted text-left max-sm:hidden"><tr><th scope="col" className="px-3 py-2">No.</th>{sortHeader("name", "Name")}{sortHeader("position", "Position")}{sortHeader("status", "Status")}{["Join Date", "Bank Data", "Action"].map(heading => <th key={heading} scope="col" className="px-3 py-2">{heading}</th>)}</tr></thead><tbody className="divide-y">{data.items.map((item, index) => <tr key={item.id} className={rowStyles[item.employmentStatus]}><td className="px-3 py-2 text-xs tabular-nums text-muted-foreground max-sm:col-span-2"><span className="sm:hidden">No. </span>{(data.page - 1) * data.pageSize + index + 1}</td><td className="max-w-64 break-words px-3 py-2"><p className="font-medium">{item.fullName}</p></td><td className="max-w-48 break-words px-3 py-2"><span className="mb-1 block text-xs text-muted-foreground sm:hidden">Position</span>{item.jobTitle || "—"}</td><td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badgeStyles[item.employmentStatus]}`}>{item.employmentStatus}</span></td><td className="whitespace-nowrap px-3 py-2"><span className="mb-1 block text-xs text-muted-foreground sm:hidden">Join Date</span>{item.joinDate || "—"}</td><td className="px-3 py-2"><span className="mb-1 block text-xs text-muted-foreground sm:hidden">Bank Data</span>{item.bankComplete ? "Complete" : "Incomplete"}</td><td className="px-3 py-2"><Button variant="ghost" size="icon" className="size-11 sm:size-9" title="Edit Employee" aria-label="Edit Employee" onClick={() => { setNotice(""); setEditor({ id: item.id }); }}><Pencil className="size-4" aria-hidden="true" /></Button></td></tr>)}</tbody></table>{!data.items.length && <p className="p-4 text-sm text-muted-foreground">Tidak ada Employee yang sesuai.</p>}</div>
      <Pagination compact path="/admin/employees" query={{ ...query, page: data.page }} pageSizeControl={<UserPageSize path="/admin/employees" pageSize={data.pageSize} query={{ ...query, page: data.page }} />} page={data.page} pageSize={data.pageSize} total={data.total} />
    </>}
    {editor && <Editor key={editor.id ?? "new"} id={editor.id} close={() => setEditor(null)} saved={(confirmed = true) => { setEditor(null); setNotice(confirmed ? "Employee berhasil disimpan." : "Periksa daftar untuk memastikan hasil sebelum membuat Employee kembali."); setRevision(n => n + 1); }} />}
  </div>;
}
