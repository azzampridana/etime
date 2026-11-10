"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, House, Timer } from "lucide-react";
import { isNavigationActive, userNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { AdminNavigationLinks } from "@/components/admin/admin-navigation-links";

const icons = { home: House, attendance: CalendarCheck, overtime: Timer };

export function NavigationLinks({ area, onNavigate, collapsed = false }: { area: "user" | "admin"; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  if (area === "admin") return <AdminNavigationLinks collapsed={collapsed} onNavigate={onNavigate} />;
  return userNavigation.map(({ href, label, icon }) => {
    const active = isNavigationActive(pathname, href);
    const Icon = icons[icon];
    return <Link key={href} href={href} prefetch={false} onClick={onNavigate} aria-current={active ? "page" : undefined}
      className={cn("flex min-h-12 items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700",
        "min-w-0 flex-1 flex-col justify-center gap-1 rounded-xl px-1 py-2 text-xs focus-visible:outline-blue-700 motion-safe:active:scale-[0.97] motion-reduce:transition-none",
        active ? "bg-blue-50 font-semibold text-blue-900 ring-1 ring-inset ring-blue-100" : "text-slate-600 hover:bg-slate-50 active:bg-slate-100")}>
      <Icon aria-hidden="true" className="size-5 shrink-0" />{label}
    </Link>;
  });
}
