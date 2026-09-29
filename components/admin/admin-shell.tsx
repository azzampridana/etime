"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import type { AccountIdentity } from "@/components/user/account-menu";

const PREFERENCE_KEY = "etime.admin.sidebar.collapsed";

export function AdminShell({ user, children }: { user: AccountIdentity; children: React.ReactNode }) {
  // Server and initial client render agree; local preference is read only after hydration.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(PREFERENCE_KEY) === "true"); } catch { /* Storage may be disabled. */ }
  }, []);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(PREFERENCE_KEY, String(next)); } catch { /* Keep the in-memory preference. */ }
  }
  return <div className="min-h-dvh bg-muted/30">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4">Skip to content</a>
    <div className={`grid min-h-dvh min-w-0 grid-cols-[minmax(0,1fr)] ${collapsed ? "md:grid-cols-[4rem_minmax(0,1fr)]" : "md:grid-cols-[16rem_minmax(0,1fr)]"}`}>
      <AdminSidebar collapsed={collapsed} />
      <div className="min-w-0">
        <AdminHeader user={user} collapsed={collapsed} onToggle={toggle} />
        <main id="main-content" tabIndex={-1} className="min-w-0 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  </div>;
}
