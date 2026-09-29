import Link from "next/link";
import type { ReactNode } from "react";

export function Pagination({ path, query, page, pageSize, total, compact = false, pageSizeControl }: {
  path: string; query: Record<string, string | number | undefined>; page: number; pageSize: number; total: number; compact?: boolean; pageSizeControl?: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  function href(next: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    params.set("page", String(next));
    return `${path}?${params}`;
  }
  if (compact) return <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
    {pageSizeControl}
    <p className="text-muted-foreground">Showing {total && (page - 1) * pageSize < total ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize < total ? Math.min(page * pageSize, total) : 0} of {total}</p>
    <div className="flex items-center gap-3">{page > 1 && <Link className="inline-flex h-10 items-center underline" href={href(Math.min(page - 1, pages))}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link className="inline-flex h-10 items-center underline" href={href(page + 1)}>Next</Link>}</div>
  </nav>;
  return <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center gap-4 text-sm">
    <p>{total} records · Page {page} of {pages}</p>
    {page > 1 && <><Link className="inline-flex min-h-11 items-center underline" href={href(1)}>First</Link><Link className="inline-flex min-h-11 items-center underline" href={href(page - 1)}>Previous</Link></>}
    {page < pages && <Link className="inline-flex min-h-11 items-center underline" href={href(page + 1)}>Next</Link>}
  </nav>;
}
