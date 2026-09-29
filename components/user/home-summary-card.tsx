import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatAdminEventTime } from "@/lib/date-time/event-time";

type EventTime = { at: string; timezone: string };
const tones = {
  neutral: "bg-muted text-muted-foreground",
  active: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

function SummaryEvent({ label, event, placeholder }: { label: string; event: EventTime | null; placeholder: string }) {
  return (
    <div className="min-w-0 space-y-1.5 [overflow-wrap:anywhere]">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</dt>
      <dd>{event ? <time dateTime={event.at} title={formatAdminEventTime(event.at, event.timezone)}
        aria-label={formatAdminEventTime(event.at, event.timezone)} className="text-lg font-semibold tabular-nums sm:text-xl">
        {formatAdminEventTime(event.at, event.timezone, true)}
      </time> : <span className="text-sm text-muted-foreground">{placeholder}</span>}</dd>
    </div>
  );
}

export function HomeSummaryCard({ id, title, workDate, status, tone, checkIn, checkOut, checkOutPlaceholder = "Not yet",
  showEvents = true, showCheckOut = true, description, href, cta }: {
  id: string; title: string; workDate?: string; status: string; tone: keyof typeof tones;
  checkIn: EventTime | null; checkOut: EventTime | null; checkOutPlaceholder?: string;
  showEvents?: boolean; showCheckOut?: boolean; description?: string; href: "/attendance" | "/overtime"; cta: string;
}) {
  return (
    <section aria-labelledby={id}>
      <Card>
        <CardHeader className="gap-3">
          <div>
            <h2 id={id} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
            {workDate && <p className="mt-1 text-xs text-muted-foreground">Work date: {workDate}</p>}
          </div>
          <span className={`inline-flex w-fit max-w-full items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${tones[tone]}`}>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{status}
          </span>
        </CardHeader>
        <CardContent>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {showEvents && <dl className="grid grid-cols-2 gap-4">
            <SummaryEvent label="CHECK IN" event={checkIn} placeholder="Not checked in yet" />
            {showCheckOut && <SummaryEvent label="CHECK OUT" event={checkOut} placeholder={checkOutPlaceholder} />}
          </dl>}
        </CardContent>
        <CardFooter className="bg-transparent py-2">
          <Link href={href} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            {cta}<ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        </CardFooter>
      </Card>
    </section>
  );
}
