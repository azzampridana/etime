import { AccountMenu, type AccountIdentity } from "@/components/user/account-menu";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AdminMobileNavigation } from "@/components/admin/admin-navigation";
import { Brand } from "@/components/shared/brand";

export function AdminHeader({ user, collapsed, onToggle }: { user: AccountIdentity; collapsed: boolean; onToggle: () => void }) {
  return <header className="sticky top-0 z-30 border-b bg-background pt-[env(safe-area-inset-top)]">
    <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button type="button" variant="ghost" className="hidden size-11 p-0 md:inline-flex" onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="admin-sidebar">
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-5" /> : <PanelLeftClose aria-hidden="true" className="size-5" />}
        </Button>
        <AdminMobileNavigation />
        <div className="md:hidden"><Brand variant="mark" /></div>
      </div>
      <AccountMenu user={user} />
    </div>
  </header>;
}
