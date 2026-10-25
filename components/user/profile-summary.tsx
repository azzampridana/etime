import type { UserDto } from "@/types/user";

export function ProfileSummary({ user, businessDateLabel }: { user: Pick<UserDto, "name" | "position">; businessDateLabel?: string }) {
  return (
    <section aria-labelledby="employee-heading" className="space-y-1 [overflow-wrap:anywhere]">
      <p className="text-xs leading-4 font-medium tracking-wide text-slate-600">Welcome back,</p>
      <h1 id="employee-heading" className="text-base leading-5 font-semibold tracking-tight">{user.name}</h1>
      {user.position && <p className="text-xs leading-4 text-muted-foreground">{user.position}</p>}
      {businessDateLabel && <p className="flex items-start gap-2 pt-1 text-xs leading-4 text-slate-600"><span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-blue-500" />{businessDateLabel}</p>}
    </section>
  );
}
