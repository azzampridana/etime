import { UserAttendanceNavigation } from "@/components/attendance/user-attendance-navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full min-w-0 max-w-5xl [overflow-wrap:anywhere]">
    <UserAttendanceNavigation active="requests" />
    {children}
  </div>;
}
