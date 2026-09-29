import { Brand } from "@/components/shared/brand";
import { AccountMenu, type AccountIdentity } from "@/components/user/account-menu";

export function UserHeader({ user }: { user: AccountIdentity }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">E</span>
          <Brand />
        </div>
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
