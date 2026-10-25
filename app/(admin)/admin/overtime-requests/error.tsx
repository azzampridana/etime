"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return <Card className="mx-auto w-full max-w-5xl rounded-2xl"><CardContent role="alert" className="space-y-4"><h2 className="font-semibold">Requests unavailable</h2><p>Unable to load overtime requests. Reload before making a decision.</p>
    <Button className="min-h-11" variant="outline" onClick={reset}>Reload view</Button></CardContent></Card>;
}
