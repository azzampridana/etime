"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" disabled={pending} className="h-12">{pending ? "Signing out…" : "Sign Out"}</Button>;
}

export function LogoutButton() {
  return <form action={logoutAction}><SubmitButton /></form>;
}
