"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function UserPageSize({ pageSize, query, path = "/admin/users" }: { pageSize: number; query: Record<string, string | number | undefined>; path?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <label className="flex items-center gap-2 whitespace-nowrap text-sm">
    Rows per page:
    <select value={pageSize} disabled={pending} aria-busy={pending} className="h-9 rounded-lg border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" onChange={event => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
      params.set("pageSize", event.target.value);
      params.set("page", "1");
      startTransition(() => router.push(`${path}?${params}`, { scroll: false }));
    }}>
      {[15, 30, 50].map(size => <option key={size} value={size}>{size}</option>)}
    </select>
  </label>;
}
