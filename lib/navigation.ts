export const userNavigation = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/attendance", label: "Attendance", icon: "attendance" },
  { href: "/overtime", label: "Overtime", icon: "overtime" },
] as const;

export const adminNavigation = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/attendance", label: "Attendance", icon: "attendance" },
  { href: "/admin/overtime", label: "Overtime", icon: "overtime" },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
] as const;

export function isNavigationActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}
