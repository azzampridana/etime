"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { checkInAction } from "@/actions/attendance/check-in";
import { checkOutAction } from "@/actions/attendance/check-out";
import { AttendanceSummary } from "@/components/attendance/attendance-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { acquireLocation as getLocation, type LocationState } from "@/lib/geolocation/acquire-location";
import type { AttendanceDto } from "@/types/attendance";

export function AttendanceEventForm({ mode, attendanceId, disabled = false, onPendingChange }: {
  mode: "check-in" | "check-out";
  attendanceId?: string;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const checkingOut = mode === "check-out";
  const label = checkingOut ? "Check Out" : "Check In";
  const router = useRouter();
  const [location, setLocation] = useState<LocationState>({ status: "idle" });
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState("");
  const [attendance, setAttendance] = useState<AttendanceDto | null>(null);

  async function acquireLocation() {
    setMessage("");
    setLocation({ status: "loading" });
    try { setLocation({ status: "ready", evidence: await getLocation() }); }
    catch (error) { setLocation({ status: "error", message: error instanceof Error ? error.message : "Unable to get your location." }); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (location.status !== "ready" || submitting.current || disabled) return;
    submitting.current = true;
    setPending(true);
    onPendingChange?.(true);
    setMessage("");
    try {
      const result = await (checkingOut ? checkOutAction : checkInAction)({ ...location.evidence, description, ...(checkingOut ? { attendanceId } : {}) });
      if (result.success && result.data) {
        setAttendance(result.data);
        setMessage(result.message);
      } else {
        setMessage([result.message, ...Object.values(result.fieldErrors ?? {}).flat()].join(" "));
      }
      // Also recover state after a duplicate response from another tab/retry.
      router.refresh();
    } catch {
      setMessage("Unable to reach the server. Please check your connection and try again.");
    } finally {
      submitting.current = false;
      setPending(false);
      onPendingChange?.(false);
    }
  }

  if (attendance) return <div className="space-y-4"><p role="status">{message}</p><AttendanceSummary attendance={attendance} /></div>;
  return <Card>
    <CardHeader><h2 className="text-lg font-semibold">{checkingOut ? "Check Out" : "Regular attendance"}</h2><p className="text-muted-foreground">{checkingOut ? "Save your Daily Report, then acquire a fresh location to check out." : "Acquire your location when you are ready to check in."}</p></CardHeader>
    <CardContent>
      <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
        <section aria-labelledby={`${mode}-location-heading`} className="space-y-3">
          <h3 id={`${mode}-location-heading`} className="font-medium">{checkingOut ? "Checkout location" : "Location"}</h3>
          <div aria-live="polite" className="break-words text-sm leading-6">
            {location.status === "idle" && <p>Location is required for this {checkingOut ? "checkout" : "check-in"}.</p>}
            {location.status === "loading" && <p>Detecting your location…</p>}
            {location.status === "error" && <p role="alert">{location.message}</p>}
            {location.status === "ready" && <><p className="font-medium text-teal-800">Location detected</p>
              <dl><dt>Latitude</dt><dd>{location.evidence.latitude}</dd><dt>Longitude</dt><dd>{location.evidence.longitude}</dd>
                <dt>Accuracy</dt><dd>±{location.evidence.accuracy} m</dd><dt>Timezone</dt><dd>{location.evidence.timezone}</dd></dl></>}
          </div>
          <Button type="button" variant="outline" className="min-h-12 w-full" onClick={acquireLocation} disabled={disabled || pending || location.status === "loading"}>
            {location.status === "error" ? "Try Again" : location.status === "ready" ? "Refresh location" : "Get location"}
          </Button>
        </section>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-description`}>{checkingOut ? "Checkout description (optional)" : "Description (optional)"}</Label>
          <textarea id={`${mode}-description`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} disabled={disabled || pending}
            className="w-full resize-y rounded-lg border border-input bg-background p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        {message && <p role="alert" className="break-words text-sm">{message}</p>}
        <Button type="submit" className="min-h-12 w-full" disabled={disabled || pending || location.status !== "ready"}>{pending ? checkingOut ? "Checking out…" : "Checking in…" : label}</Button>
      </form>
    </CardContent>
  </Card>;
}
