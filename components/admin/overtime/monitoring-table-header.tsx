import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export function OvertimeSortHeader({ field, label, query, className }: { field: string; label: string; query: Record<string, string | number | undefined>; className?: string }) {
  const active = query.sort === field && !!query.order;
  const nextOrder = active && query.order === "asc" ? "desc" : "asc";
  const Icon = active ? query.order === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  params.set("sort", field); params.set("order", nextOrder); params.set("page", "1");
  return <th scope="col" className={className} aria-sort={active ? query.order === "asc" ? "ascending" : "descending" : "none"}>
    <Link href={`/admin/overtime?${params}`} scroll={false} className="inline-flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Sort ${label} ${nextOrder === "asc" ? "ascending" : "descending"}`}>{label}<Icon aria-hidden="true" className="size-3.5 shrink-0" /></Link>
  </th>;
}

export const overtimeTableClass = "w-full text-left text-sm [&_th]:border-b [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-medium [&_td]:border-b [&_td]:px-3 [&_td]:py-1.5 [&_tr:last-child_td]:border-0";
