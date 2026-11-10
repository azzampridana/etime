import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
export const dynamic = "force-dynamic";
export default async function PayslipsLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (user.role !== "USER") redirect("/admin");
  return children;
}
