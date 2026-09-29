import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLoginDestination } from "@/lib/auth/destination";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(getLoginDestination(user.role));

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-2">
          <p className="text-sm text-muted-foreground">Enneaphos Group</p>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in to ETime</h1>
          <p className="text-sm text-muted-foreground">Workforce Attendance &amp; Activity</p>
        </CardHeader>
        <CardContent><LoginForm /></CardContent>
      </Card>
    </main>
  );
}
