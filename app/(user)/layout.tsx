import { UserHeader } from "@/components/user/user-header";
import { BottomNavigation } from "@/components/user/bottom-navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getUserById } from "@/services/user.service";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const identity = await requirePageUser();
  const user = await getUserById(identity.id);
  return (
    <div className="min-h-dvh bg-muted/30">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4">Skip to content</a>
      <UserHeader user={{ name: user.name, position: user.position, email: user.email }} />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-5 pt-8 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-10">{children}</main>
      <BottomNavigation />
    </div>
  );
}
