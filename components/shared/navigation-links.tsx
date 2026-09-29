"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ChartNoAxesCombined, House, LayoutDashboard, Timer, Users } from "lucide-react";
import { adminNavigation, isNavigationActive, userNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Tooltip } from "radix-ui";

const icons = { home: House, attendance: CalendarCheck, overtime: Timer, dashboard: LayoutDashboard, users: Users, reports: ChartNoAxesCombined };

export function NavigationLinks({ area, onNavigate, collapsed = false }: { area: "user" | "admin"; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const items = area === "user" ? userNavigation : adminNavigation;
  return items.map(({ href, label, icon }) => {
    const active = isNavigationActive(pathname, href);
    const Icon = icons[icon];
    const iconOnly = area === "admin" && collapsed;
    const link = (
      <Link key={href} href={href} prefetch={false} onClick={onNavigate} aria-current={active ? "page" : undefined}
        aria-label={iconOnly ? label : undefined}
        className={cn("flex min-h-12 items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700",
          area === "user" ? "flex-1 flex-col justify-center gap-1 py-2 text-xs" : iconOnly ? "w-full min-w-0 justify-center overflow-hidden p-0" : "w-full min-w-0 gap-3 overflow-hidden px-3",
          active ? "bg-teal-50 text-teal-900" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
        <Icon aria-hidden="true" className="size-5 shrink-0" />{!iconOnly && (area === "admin" ? <span className="min-w-0 truncate">{label}</span> : label)}
      </Link>
    );
    return iconOnly ? <Tooltip.Provider key={href} delayDuration={200}><Tooltip.Root>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Content side="right" sideOffset={10} className="z-50 rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-sm">{label}<Tooltip.Arrow className="fill-foreground" /></Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root></Tooltip.Provider> : link;
  });
}
