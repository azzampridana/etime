import type { UserDto } from "@/types/user";

export function ProfileSummary({ user, businessDateLabel }: { user: Pick<UserDto, "name" | "position">; businessDateLabel?: string }) {
  return (
    <section aria-labelledby="employee-heading" className="space-y-1 [overflow-wrap:anywhere]">
      <p className="text-sm text-muted-foreground">Welcome back,</p>
      <h1 id="employee-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">{user.name}</h1>
      {user.position && <p className="text-sm text-muted-foreground">{user.position}</p>}
      {businessDateLabel && <p className="pt-2 text-sm text-muted-foreground">{businessDateLabel}</p>}
    </section>
  );
}
