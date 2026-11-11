"use client";

import { useId, useState, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ChartNoAxesCombined, ChevronDown, ClipboardList, FileClock, LayoutDashboard, Timer, Users, Wallet } from "lucide-react";
import { Tooltip } from "radix-ui";
import { adminNavigation, isNavigationActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const icons = { attendance: CalendarCheck, attendanceRequests: ClipboardList, overtime: Timer,
  overtimeRequests: FileClock, dashboard: LayoutDashboard, users: Users, reports: ChartNoAxesCombined, payroll: Wallet };
type Item = (typeof adminNavigation)[number];
type Group = Extract<Item, { children: readonly unknown[] }>;
type NavLink = Exclude<Item, Group> | Group["children"][number];
const base = "flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";
const activeStyle = "bg-sidebar-accent font-semibold text-sidebar-accent-foreground ring-1 ring-inset ring-sidebar-primary/10";
const idleStyle = "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground";

function RailLabel({ label, children, collapsed }: { label: string; children: ReactElement; collapsed: boolean }) {
  if (!collapsed) return children;
  return <Tooltip.Root><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal>
    <Tooltip.Content side="right" sideOffset={10} className="z-50 rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-sm">{label}<Tooltip.Arrow className="fill-foreground" /></Tooltip.Content>
  </Tooltip.Portal></Tooltip.Root>;
}
function NavigationItem({ item, pathname, collapsed, child = false, onNavigate }: {
  item: NavLink; pathname: string; collapsed: boolean; child?: boolean; onNavigate?: () => void;
}) {
  const active = isNavigationActive(pathname, item.href), Icon = icons[item.icon];
  return <RailLabel label={item.label} collapsed={collapsed}><Link href={item.href} prefetch={false} onClick={onNavigate}
    aria-label={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined}
    className={cn(base, active ? activeStyle : idleStyle, collapsed ? "justify-center px-0" : child ? "pl-4 text-[13px]" : "font-medium")}>
    <Icon aria-hidden="true" className={cn("shrink-0", !active && "text-muted-foreground", child ? "size-4" : "size-[18px]")} />
    {!collapsed && <span className="min-w-0 flex-1 break-words py-2 leading-5">{item.label}</span>}
    {active && !collapsed && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />}
  </Link></RailLabel>;
}
function NavigationGroup({ group, pathname, collapsed, onNavigate }: {
  group: Group; pathname: string; collapsed: boolean; onNavigate?: () => void;
}) {
  const active = group.children.some(item => isNavigationActive(pathname, item.href));
  // Parent keys include pathname: route changes reset to route-derived expansion.
  // Manual toggles remain authoritative for the current pathname.
  const [open, setOpen] = useState(active);
  const id = useId(), Icon = icons[group.icon];
  return <div className="min-w-0">
    <RailLabel collapsed={collapsed} label={group.label}><button type="button" aria-expanded={open} aria-controls={id}
      aria-label={collapsed ? group.label : undefined} onClick={() => setOpen(value => !value)}
      className={cn(base, "relative font-medium", active ? activeStyle : idleStyle, collapsed && "justify-center px-0")}>
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{group.label}</span>}
      <ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180", collapsed && "absolute bottom-0.5 right-0.5 size-2.5")} />
    </button></RailLabel>
    <div id={id} inert={!open} className={cn("grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="min-h-0 overflow-hidden"><div className={cn("space-y-0.5 pt-1", !collapsed && "ml-4")}>
        {group.children.map(item => <NavigationItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} child onNavigate={onNavigate} />)}
      </div></div>
    </div>
  </div>;
}
export function AdminNavigationLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <Tooltip.Provider delayDuration={200}>{adminNavigation.map(item => "children" in item
    ? <NavigationGroup key={`${item.label}:${pathname}`} group={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
    : <NavigationItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />)}</Tooltip.Provider>;
}
