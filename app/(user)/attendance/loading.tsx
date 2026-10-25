import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return <Card className="mx-auto w-full max-w-5xl rounded-2xl"><CardContent role="status" className="flex items-center gap-3 py-4">
    <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-primary motion-safe:animate-spin" />
    <p className="text-sm text-muted-foreground">Loading attendance…</p>
  </CardContent></Card>;
}
