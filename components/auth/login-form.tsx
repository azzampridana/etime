"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { success: false, message: "" });

  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required className="h-12 text-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" maxLength={72} required className="h-12 text-base" />
        </div>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">{state.message}</p>
        <Button type="submit" disabled={pending} className="h-12 w-full text-base">
          {pending ? "Signing in…" : "Sign In"}
        </Button>
      </fieldset>
    </form>
  );
}
