"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { loginSchema } from "@/schemas/auth.schema";
import type { ActionResult } from "@/types/action-result";

export async function loginAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!input.success) return { success: false, message: "Invalid email or password." };
  try {
    await signIn("credentials", { ...input.data, redirect: false, redirectTo: "/" });
  } catch (error) {
    console.error("[AUTH_LOGIN_ERROR]", error);

    if (error instanceof AuthError) {
      console.error("[AUTH_LOGIN_TYPE]", error.type);
      console.error("[AUTH_LOGIN_CAUSE]", error.cause);
    }

    return {
      success: false,
      message:
        error instanceof AuthError && error.type === "CredentialsSignin"
          ? "Invalid email or password."
          : "Unable to sign in. Please try again.",
    };
  }
  // Resolve the current DB role on a new request, after the cookie has been set.
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false, redirectTo: "/login" });
  redirect("/login");
}
