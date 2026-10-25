import Link from "next/link";

export function UserOvertimeNavigation({ active }: { active: "current" | "history" | "requests" }) {
  return <nav aria-label="Overtime views" className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border bg-card/80 p-1.5">
    {([{ key: "current", label: "Current", href: "/overtime" }, { key: "history", label: "History", href: "/overtime/history" }, { key: "requests", label: "Requests", href: "/overtime/requests" }] as const).map(item =>
      <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined}
        className={`flex min-h-12 min-w-0 items-center justify-center rounded-xl px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${active === item.key ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>{item.label}</Link>)}
  </nav>;
}
