import { redirect } from "next/navigation";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLoginDestination } from "@/lib/auth/destination";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(getLoginDestination(user.role));

  return (
    <main className="flex flex-1 items-center justify-center bg-linear-to-br from-muted via-background to-muted px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md space-y-5">
        <Card className="gap-6 rounded-2xl border border-border/70 py-6 shadow-lg shadow-foreground/5 ring-0 sm:py-8">
          <CardHeader className="gap-2 px-6 text-left sm:px-8">
            <Image
              src="/branding/etime-logo-horizontal.png"
              alt="ETime"
              width={2171}
              height={724}
              className="mx-auto mb-4 h-auto w-56 max-w-full object-contain sm:w-60"
            />

            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back
            </h1>

            <p className="text-sm text-muted-foreground">
              Sign in to your ETime account.
            </p>
          </CardHeader>
          <CardContent className="px-6 sm:px-8"><LoginForm /></CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Enneaphos Group</p>
      </div>
    </main>
  );
}
