import Link from "next/link";

export function OvertimeNavigation({ active }: { active: "authorization" | "activity" }) {
  return <nav aria-label="Overtime sections" className="mb-4 flex flex-wrap gap-2">
    {([['activity', '/admin/overtime', 'Activity'], ['authorization', '/admin/overtime?view=authorization', 'Authorization']] as const).map(([key, href, label]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined} className={`inline-flex h-10 items-center rounded-lg border px-4 text-sm ${active === key ? "bg-primary font-semibold text-primary-foreground" : "bg-card"}`}>{label}</Link>)}
  </nav>;
}
