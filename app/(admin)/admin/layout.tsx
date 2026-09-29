import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageUser } from "@/lib/authorization/page-access";
import { NotificationProvider } from "@/components/shared/notification-provider";
import { getUserById } from "@/services/user.service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await requirePageUser(true);
  const user = await getUserById(identity.id);
  return <NotificationProvider><AdminShell user={{ name: user.name, position: user.position, email: user.email }}>{children}</AdminShell></NotificationProvider>;
}
