import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { UserOvertimeNavigation } from "@/components/overtime/user-overtime-navigation";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (user.role !== "USER") redirect("/admin");
  return <><UserOvertimeNavigation active="requests" />{children}</>;
}
