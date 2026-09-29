import { ProfileSummary } from "@/components/user/profile-summary";
import { HomeSummaryCard } from "@/components/user/home-summary-card";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getUserById } from "@/services/user.service";
import { getHomeAttendance } from "@/services/attendance.service";
import { getHomeOvertime } from "@/services/overtime.service";
import { getBusinessDate, formatBusinessDate } from "@/lib/date-time/event-time";

export default async function HomePage() {
  const identity = await requirePageUser();
  const now = new Date();
  const [profile, attendance] = await Promise.all([
    getUserById(identity.id), getHomeAttendance(identity.id, () => now),
  ]);
  const overtime = attendance ? await getHomeOvertime(identity.id, attendance.id) : null;
  return (
    <div className="space-y-6">
      <ProfileSummary user={profile} businessDateLabel={formatBusinessDate(getBusinessDate(now))} />
      <HomeSummaryCard
        id="home-attendance" title={attendance ? "Attendance" : "Today's Attendance"}
        workDate={attendance?.workDate}
        status={!attendance ? "Not Checked In" : attendance.isOpen ? "Working" : "Completed"}
        tone={!attendance ? "neutral" : attendance.isOpen ? "active" : "success"}
        checkIn={attendance ? { at: attendance.checkInAt, timezone: attendance.checkInTimezone } : null}
        checkOut={attendance?.checkOutAt && attendance.checkOutTimezone
          ? { at: attendance.checkOutAt, timezone: attendance.checkOutTimezone } : null}
        checkOutPlaceholder={attendance ? "Not yet" : "—"}
        href="/attendance" cta={!attendance ? "Check In" : attendance.isOpen ? "Continue Attendance" : "View Attendance"}
      />
      {overtime && <HomeSummaryCard
        id="home-overtime" title="Overtime"
        status={overtime.state === "authorized" ? "Authorized" : overtime.state === "open" ? "Overtime in Progress" : "Completed"}
        tone={overtime.state === "completed" ? "success" : "active"}
        description={overtime.state === "authorized" ? "Overtime has been authorized for this attendance." : undefined}
        showEvents={overtime.state !== "authorized"}
        checkIn={overtime.state === "authorized" ? null : overtime.checkIn}
        checkOut={overtime.state === "authorized" ? null : overtime.checkOut}
        showCheckOut={overtime.state === "completed"}
        href="/overtime" cta={overtime.state === "open" ? "Continue Overtime" : "View Overtime"}
      />}
    </div>
  );
}
