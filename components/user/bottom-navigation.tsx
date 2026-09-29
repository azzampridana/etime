import { NavigationLinks } from "@/components/shared/navigation-links";

export function BottomNavigation() {
  return (
    <nav aria-label="Worker navigation" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-3xl gap-2 px-4 py-2"><NavigationLinks area="user" /></div>
    </nav>
  );
}
