"use server";

import { CredentialsSignin } from "next-auth";
import { z } from "zod";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { loginSchema } from "@/schemas/auth.schema";
import type { ActionResult } from "@/types/action-result";
import type { LoginResult } from "@/types/login";

export async function loginAction(_previous: ActionResult, formData: FormData): Promise<LoginResult> {
  const input = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!input.success) return { success: false, message: "Periksa email dan password Anda.", failure: "VALIDATION_ERROR", fieldErrors: z.flattenError(input.error).fieldErrors };
  try {
    await signIn("credentials", { ...input.data, redirect: false, redirectTo: "/" });
  } catch (error) {
    return {
      success: false,
      message: "",
      failure: error instanceof CredentialsSignin
        ? error.code === "INACTIVE_ACCOUNT" ? "INACTIVE_ACCOUNT" : "INVALID_CREDENTIALS"
        : "SYSTEM_ERROR",
    };
  }
  // The client navigates only after success; / resolves the current database role.
  return { success: true, message: "" };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false, redirectTo: "/login" });
  redirect("/login");
}
