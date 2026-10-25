import type { AttendanceProvenance } from "@/types/attendance";

/** Compact read-only provenance; normal events keep their existing presentation. */
export function AttendanceProvenanceNote({ checkInSource, checkOutSource }: Pick<AttendanceProvenance, "checkInSource" | "checkOutSource">) {
  const checkIn = checkInSource === "ADMIN_CORRECTION";
  const checkOut = checkOutSource === "ADMIN_CORRECTION";
  if (!checkIn && !checkOut) return null;
  return <p className="text-xs text-muted-foreground">Admin-approved correction: {checkIn && checkOut ? "Check In and Check Out" : checkIn ? "Check In" : "Check Out"}. Times are employee-declared and reviewed.</p>;
}
