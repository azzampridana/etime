import Image from "next/image";

export function Brand({ variant = "horizontal" }: { variant?: "horizontal" | "compact" | "mark" }) {
  if (variant === "horizontal") {
    return <Image src="/branding/etime-logo-horizontal.png" alt="ETime" width={2171} height={724} className="h-auto w-36 max-w-full shrink-0 object-contain" />;
  }
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <div className="relative size-9 shrink-0">
        <Image src="/branding/etime-logo.png" alt={variant === "compact" ? "" : "ETime"} fill sizes="36px" className="object-contain" />
      </div>
      {variant === "compact" && <div>
        <p className="text-xl font-semibold tracking-tight">ETime</p>
        <p className="text-xs text-muted-foreground">Enneaphos Group</p>
      </div>}
    </div>
  );
}
