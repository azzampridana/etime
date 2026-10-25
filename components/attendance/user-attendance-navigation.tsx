import Link from "next/link";

export function UserAttendanceNavigation({ active }: { active: "today" | "list" | "requests" }) {
  return <nav aria-label="Attendance views" className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border bg-card/80 p-1.5">
    {([{ key: "today", label: "Today", href: "/attendance" }, { key: "list", label: "History", href: "/attendance?view=history" }, { key: "requests", label: "Requests", href: "/attendance/requests" }] as const).map(item =>
      <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined}
        className={`flex min-h-12 min-w-0 items-center justify-center rounded-xl px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${active === item.key ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>{item.label}</Link>)}
  </nav>;
}
