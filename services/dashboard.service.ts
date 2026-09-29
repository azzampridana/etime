import "server-only";
import { getBusinessDate } from "@/lib/date-time/event-time";
import { ADMIN_REFERENCE_TIMEZONE } from "@/lib/date-time/constants";
import type { AttendanceActivityBucket } from "@/types/dashboard";
import { readDashboardRecords } from "@/repositories/dashboard.repository";
import { canGrantOvertimeAuthorization } from "@/services/overtime-authorization.service";

/** Called behind the existing ADMIN page boundary. No new mutation path. */
export async function getAdminDashboard() {
  const workDate = getBusinessDate();
  const records = await readDashboardRecords(new Date(`${workDate}T00:00:00.000Z`));
  const activity: AttendanceActivityBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`, checkIn: 0, checkOut: 0,
  }));
  const hourFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: ADMIN_REFERENCE_TIMEZONE, hour: "2-digit", hourCycle: "h23",
  });
  for (const event of records.activityEvents) {
    for (const [series, at] of [["checkIn", event.checkInAt], ["checkOut", event.checkOutAt]] as const) {
      // A timestamp outside this business date must not wrap into today's hour buckets.
      if (at && getBusinessDate(at) === workDate) activity[Number(hourFormatter.format(at))][series] += 1;
    }
  }
  const summarize = (item: (typeof records.recent)[number]) => ({
    id: item.id, employee: { name: item.user.name, position: item.user.position },
    checkInAt: item.checkInAt.toISOString(), checkInTimezone: item.checkInTimezone,
    checkOutAt: item.checkOutAt?.toISOString() ?? null, checkOutTimezone: item.checkOutTimezone,
    state: item.checkOutAt ? "Completed" : "Working",
  });
  return {
    workDate,
    activity,
    attendance: { checkedIn: records.working + records.completed, working: records.working, completed: records.completed },
    overtime: { authorized: records.authorized, inProgress: records.overtimeInProgress, completed: records.overtimeCompleted },
    attention: { historicalIncomplete: records.historicalIncomplete, openOvertime: records.openOvertime },
    recent: records.recent.map(summarize),
    candidates: records.candidates.map((item) => {
      const authorization = item.overtimeAuthorization;
      // Recorded activity takes precedence over later revocation or deactivation.
      const access = authorization?.overtime ? (authorization.overtime.checkOutAt ? "Completed" : "In Progress")
        : authorization?.revokedAt ? "Revoked"
          : !canGrantOvertimeAuthorization(item.checkOutAt, item.user.isActive) ? "Unavailable"
            : authorization ? "Authorized" : "Grant OT";
      return { ...summarize(item), access };
    }),
  };
}
