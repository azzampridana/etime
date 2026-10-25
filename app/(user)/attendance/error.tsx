"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({ reset }: { reset: () => void }) {
  return <Card className="mx-auto w-full max-w-5xl rounded-2xl"><CardContent role="alert" className="space-y-4">
    <h2 className="font-semibold">Attendance unavailable</h2>
    <p className="text-sm text-muted-foreground">Unable to load attendance. Please try again.</p>
    <Button className="min-h-11" variant="outline" onClick={reset}>Try again</Button>
  </CardContent></Card>;
}
