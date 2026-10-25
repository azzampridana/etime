"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-3 rounded-xl border bg-card p-5"><p>Unable to load Attendance Requests. Reload to retrieve the latest server state.</p><Button onClick={reset}>Try again</Button><Button variant="outline" onClick={() => window.location.reload()}>Reload</Button></div>;
}
