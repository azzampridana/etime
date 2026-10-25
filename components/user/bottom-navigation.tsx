import { NavigationLinks } from "@/components/shared/navigation-links";

export function BottomNavigation() {
  return (
    <nav aria-label="Worker navigation" className="pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-3xl px-5 sm:px-8">
      <div className="pointer-events-auto flex gap-1 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-lg shadow-slate-950/10"><NavigationLinks area="user" /></div>
    </nav>
  );
}
