import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLoginDestination } from "@/lib/auth/destination";

export default async function IndexPage() {
  const user = await getCurrentUser();
  redirect(user ? getLoginDestination(user.role) : "/login");
}
