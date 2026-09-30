import Link from "next/link";
import { LogIn, Clock3, CircleCheck, type LucideIcon } from "lucide-react";
import { AttendanceActivityChart } from "@/components/admin/dashboard/attendance-activity-chart";
import { OvertimeDistributionChart } from "@/components/admin/dashboard/overtime-distribution-chart";
import { DataTable } from "@/components/admin/data-table";
import { AuthorizationControls } from "@/components/admin/overtime/authorization-controls";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageUser } from "@/lib/authorization/page-access";
import { formatAdminEventTime, formatBusinessDate } from "@/lib/date-time/event-time";
import { getAdminDashboard } from "@/services/dashboard.service";

function Metric({ label, value, description, icon: Icon }: { label: string; value: number; description: string; icon: LucideIcon }) {
  return <Card size="sm"><CardContent className="relative space-y-1 pr-14">
    <span className="absolute right-3 top-0 rounded-lg bg-muted p-2 text-muted-foreground"><Icon aria-hidden="true" className="size-4" /></span>
    <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
    <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </CardContent></Card>;
}

function Employee({ name, position }: { name: string; position: string | null }) {
  return <div className="min-w-32 max-w-64 break-words"><p className="font-medium">{name}</p>{position && <p className="text-xs text-muted-foreground">{position}</p>}</div>;
}

function State({ children }: { children: string }) {
  return <span className="inline-flex whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{children}</span>;
}

const navigationClass = "inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4";

export default async function AdminPage() {
  await requirePageUser(true);
  const data = await getAdminDashboard();
  return <div className="min-w-0 space-y-7">
    <header>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
      <p className="mt-2 text-sm font-medium">{formatBusinessDate(data.workDate)} <span className="font-normal text-muted-foreground">· Asia/Jakarta</span></p>
      <p className="mt-1 text-sm text-muted-foreground">Operational overview for today&apos;s attendance and overtime.</p>
    </header>

    <section aria-labelledby="attendance-summary" className="space-y-3">
      <h2 id="attendance-summary" className="sr-only">Attendance Today</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Checked In" value={data.attendance.checkedIn} description="Attendance today" icon={LogIn} />
        <Metric label="Working" value={data.attendance.working} description="Currently working" icon={Clock3} />
        <Metric label="Completed" value={data.attendance.completed} description="Finished today" icon={CircleCheck} />
      </div>
    </section>

    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section aria-labelledby="activity-heading" className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
        <h2 id="activity-heading" className="text-base font-semibold">Today&apos;s Attendance Activity</h2>
        <p className="mb-5 mt-1 text-xs text-muted-foreground">Hourly events for today&apos;s attendance · Asia/Jakarta (WIB). Curves connect actual bucket counts.</p>
        <AttendanceActivityChart buckets={data.activity} />
      </section>
      <section aria-labelledby="overtime-summary" className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
        <h2 id="overtime-summary" className="text-base font-semibold">Overtime Today</h2>
        <p className="mb-5 mt-1 text-xs text-muted-foreground">Overtime associated with today&apos;s attendance work date.</p>
        <OvertimeDistributionChart {...data.overtime} />
      </section>
    </div>

    <section aria-labelledby="attention-heading" className="rounded-xl border bg-card px-4 py-3">
      <h2 id="attention-heading" className="text-base font-semibold">Needs Attention</h2>
      {data.attention.historicalIncomplete > 0 && <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm">
        <p>{data.attention.historicalIncomplete} historical Attendance records incomplete</p><Link className={navigationClass} href="/admin/attendance">View Attendance →</Link>
      </div>}
      {data.attention.openOvertime > 0 && <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm">
        <p>{data.attention.openOvertime} Overtime sessions currently in progress, including earlier work dates</p><Link className={navigationClass} href="/admin/overtime/activity">View Overtime →</Link>
      </div>}
      {data.attention.incompleteOvertime > 0 && <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm">
        <p>{data.attention.incompleteOvertime} Overtime sessions incomplete — Missing Checkout</p><Link className={navigationClass} href="/admin/overtime/activity">View Overtime →</Link>
      </div>}
      {!data.attention.historicalIncomplete && !data.attention.openOvertime && !data.attention.incompleteOvertime && <p className="mt-2 text-sm text-muted-foreground">No attendance items currently need attention.</p>}
    </section>

    <section aria-labelledby="authorization-heading" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4"><h2 id="authorization-heading" className="text-base font-semibold">Overtime Authorization</h2><Link className={navigationClass} href="/admin/overtime">View Overtime →</Link></div>
      <p className="text-xs text-muted-foreground">Up to 8 of today&apos;s most recent regular checkouts. Full authorization management is available in Overtime.</p>
      {data.candidates.length ? <DataTable label="Today’s overtime authorization">
        <thead><tr>{["Employee", "Checkout", "OT Access"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{data.candidates.map(item => <tr key={item.id}>
          <td><Employee {...item.employee} /></td>
          <td className="whitespace-nowrap">{item.checkOutAt && item.checkOutTimezone ? formatAdminEventTime(item.checkOutAt, item.checkOutTimezone, true) : "—"}</td>
          <td>{item.access === "Grant OT" ? <AuthorizationControls grantOnly item={{ id: item.id, employee: item.employee, workDate: data.workDate, authorizationState: "Not Authorized", authorization: null }} />
            : <div className="space-y-1"><State>{item.access}</State>{(item.access === "Revoked" || item.access === "Unavailable") && <Link href="/admin/overtime" className="block text-xs underline">View Overtime</Link>}</div>}</td>
        </tr>)}</tbody>
      </DataTable> : <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No completed Attendance currently awaiting overtime authorization.</p>}
    </section>

    <section aria-labelledby="recent-heading" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4"><h2 id="recent-heading" className="text-base font-semibold">Recent Attendance</h2><Link className={navigationClass} href="/admin/attendance">View Attendance →</Link></div>
      <p className="text-xs text-muted-foreground">Today&apos;s latest check-ins, shown in each event&apos;s local timezone.</p>
      {data.recent.length ? <DataTable label="Recent attendance today">
        <thead><tr>{["Employee", "Check In", "Check Out", "Status"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{data.recent.map(item => <tr key={item.id}>
          <td><Employee {...item.employee} /></td>
          <td className="whitespace-nowrap">{formatAdminEventTime(item.checkInAt, item.checkInTimezone, true)}</td>
          <td className="whitespace-nowrap">{item.checkOutAt && item.checkOutTimezone ? formatAdminEventTime(item.checkOutAt, item.checkOutTimezone, true) : "—"}</td>
          <td><State>{item.state}</State></td>
        </tr>)}</tbody>
      </DataTable> : <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No Attendance recorded for today.</p>}
    </section>
  </div>;
}
