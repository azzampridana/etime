export const userNavigation = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/attendance", label: "Attendance", icon: "attendance" },
  { href: "/overtime", label: "Overtime", icon: "overtime" },
] as const;

export const adminNavigation = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/employees", label: "Employees", icon: "users" },
  { label: "Attendance", icon: "attendance", children: [
    { href: "/admin/attendance", label: "Attendance", icon: "attendance" },
    { href: "/admin/attendance-requests", label: "Attendance Requests", icon: "attendanceRequests" },
  ] },
  { label: "Overtime", icon: "overtime", children: [
    { href: "/admin/overtime", label: "Overtime", icon: "overtime" },
    { href: "/admin/overtime-requests", label: "Overtime Requests", icon: "overtimeRequests" },
  ] },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
  { href: "/admin/payroll", label: "Payroll", icon: "payroll" },
] as const;

export function isNavigationActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}
