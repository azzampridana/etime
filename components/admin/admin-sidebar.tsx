import { NavigationLinks } from "@/components/shared/navigation-links";

import { Brand } from "@/components/shared/brand";

export function AdminSidebar({ collapsed }: { collapsed: boolean }) {
  return <aside id="admin-sidebar" className="sticky top-0 hidden h-dvh min-w-0 self-start flex-col overflow-x-hidden border-r bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:flex">
    <div className={`flex min-h-16 shrink-0 items-center gap-3 border-b py-2 ${collapsed ? "justify-center px-2" : "px-4"}`}>
      <Brand variant={collapsed ? "mark" : "horizontal"} />
    </div>
    <nav aria-label="Admin navigation" className={`min-h-0 min-w-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
      <NavigationLinks area="admin" collapsed={collapsed} />
    </nav>
    {!collapsed && <p className="border-t px-6 py-4 text-xs text-muted-foreground">Workforce administration</p>}
  </aside>;
}
