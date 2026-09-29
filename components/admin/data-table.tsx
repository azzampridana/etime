import type { ReactNode } from "react";

export function DataTable({ children, label }: { children: ReactNode; label: string }) {
  return <div className="max-w-full overflow-x-auto rounded-xl border bg-card" tabIndex={0} role="region" aria-label={label}>
    <table className="w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:bg-muted/50 [&_th]:p-4 [&_th]:font-medium [&_td]:border-b [&_td]:p-4 [&_td]:align-top [&_tr:last-child_td]:border-0">
      {children}
    </table>
  </div>;
}
