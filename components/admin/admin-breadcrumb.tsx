"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { adminNavigation, isNavigationActive } from "@/lib/navigation";

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const entries = adminNavigation.flatMap<{ href: string; label: string; group: string }>(item => "children" in item
    ? item.children.map(child => ({ href: child.href, label: child.label, group: item.label }))
    : [{ href: item.href, label: item.label, group: "" }]);
  const current = entries.filter(item => isNavigationActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!current) return null;
  const nested = pathname !== current.href;
  // Labels for existing static child pages; IDs are never rendered as breadcrumbs.
  const pageLabels: Record<string, string> = {
    "/admin/users/new": "New User",
    "/admin/users/work-schedules": "Work Schedules",
    "/admin/payroll/new": "New Draft",
    "/admin/payroll/components": "Mandatory Components",
    "/admin/overtime/activity": "Activity",
  };
  const detailLabel = pageLabels[pathname] ?? (pathname.endsWith("/edit") ? "Edit" : "Detail");
  return <nav aria-label="Breadcrumb" className="min-w-0 text-sm"><ol className="flex min-w-0 items-center gap-2">
    {current.group && current.group !== current.label && <li className="hidden items-center gap-2 text-muted-foreground sm:flex"><span>{current.group}</span><ChevronRight className="size-3.5" aria-hidden="true" /></li>}
    <li className="min-w-0 truncate font-medium">{nested
      ? <Link href={current.href} prefetch={false} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{current.label}</Link>
      : <span aria-current="page">{current.label}</span>}</li>
    {nested && <li className="flex min-w-0 items-center gap-2"><ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate" aria-current="page">{detailLabel}</span></li>}
  </ol></nav>;
}
