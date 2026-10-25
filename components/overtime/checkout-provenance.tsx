export function OvertimeCheckoutProvenance({ source, requestId }: {
  source: "NORMAL" | "ADMIN_CORRECTION" | null; requestId: string | null;
}) {
  if (source !== "ADMIN_CORRECTION" && !requestId) return null;
  return <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">Checkout recorded by ADMIN correction. Historical GPS, photo and event timezone were not captured.{requestId && <> Request: {requestId}</>}</p>;
}
