"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="space-y-4" role="alert"><h1 className="text-xl font-semibold">Unable to load this page</h1><p>Please try again. If the problem persists, contact your administrator.</p><Button className="min-h-12" onClick={reset}>Try again</Button></div>;
}
