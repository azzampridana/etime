"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LoginFailure, LoginResult } from "@/types/login";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const failureMessages: Record<LoginFailure, string> = {
  INVALID_CREDENTIALS: "Email atau password salah.",
  INACTIVE_ACCOUNT: "Akun Anda tidak aktif. Silakan hubungi administrator.",
  VALIDATION_ERROR: "Periksa email dan password Anda.",
  SYSTEM_ERROR: "Terjadi kesalahan saat masuk. Silakan coba lagi.",
};

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<LoginResult>({ success: false, message: "" });
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true;
    setPending(true);
    setState({ success: false, message: "" });
    try {
      const result = await loginAction({ success: false, message: "" }, data);
      if (result.success) { router.replace("/"); return; }
      setState(result);
    } catch {
      setState({ success: false, message: "", failure: "SYSTEM_ERROR" });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required className="h-12 text-base" />
          {state.fieldErrors?.email && <p className="text-sm text-destructive" role="alert">Masukkan alamat email yang valid.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" maxLength={72} required className="h-12 text-base" />
          {state.fieldErrors?.password && <p className="text-sm text-destructive" role="alert">Password wajib diisi dan maksimal 72 byte.</p>}
        </div>
        <p role="alert" aria-live="polite" className="min-h-5 break-words text-sm text-destructive">{state.failure ? failureMessages[state.failure] : ""}</p>
        <Button type="submit" disabled={pending} className="h-12 w-full text-base">
          {pending ? "Signing in…" : "Sign In"}
        </Button>
      </fieldset>
    </form>
  );
}
