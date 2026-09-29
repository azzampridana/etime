import { attendanceEvidenceSchema } from "@/schemas/attendance.schema";
export type LocationEvidence = { latitude: number; longitude: number; accuracy: number; timezone: string };
export type LocationState = { status: "idle" | "loading" } | { status: "error"; message: string } | { status: "ready"; evidence: LocationEvidence };
export function acquireLocation(): Promise<LocationEvidence> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This browser does not support location. Use a browser with location support.")); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const evidence = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      if (!attendanceEvidenceSchema.safeParse(evidence).success) reject(new Error("A valid location and device timezone are required. Check your device settings and try again."));
      else resolve(evidence);
    }, error => {
      const messages: Record<number, string> = {
        1: "Location permission is required. Allow location in your browser settings and try again.",
        2: "Your location is unavailable. Check your device location settings and try again.",
        3: "Location request timed out. Move to a place with a better signal and try again.",
      };
      reject(new Error(messages[error.code] || "Unable to get your location. Please try again."));
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  });
}
