"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return <Card className="mx-auto w-full max-w-5xl rounded-2xl"><CardContent role="alert" className="space-y-4"><h2 className="font-semibold">Requests unavailable</h2>
    <p>Unable to load overtime correction requests. Please try again.</p>
    <Button className="min-h-11" type="button" variant="outline" onClick={reset}>Reload view</Button>
    <Button asChild variant="outline" className="min-h-11"><Link href="/overtime/history">Back to Overtime History</Link></Button>
  </CardContent></Card>;
}
