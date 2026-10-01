"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { checkInAction } from "@/actions/attendance/check-in";
import { checkOutAction } from "@/actions/attendance/check-out";
import { prepareAttendanceLocationAction } from "@/actions/attendance/prepare-location";
import { GeocodingAttribution } from "@/components/shared/geocoding-attribution";
import { AttendanceSummary } from "@/components/attendance/attendance-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { acquireLocation as getLocation, type LocationEvidence } from "@/lib/geolocation/acquire-location";
import { ATTENDANCE_LOCATION_MAX_AGE_MS } from "@/schemas/attendance.schema";
import type { AttendanceDto } from "@/types/attendance";

type ReadyLocation = { status: "ready"; evidence: LocationEvidence; receipt: string; address: string | null; expiresAt: number; deadline: number };
type AttendanceLocationState = { status: "idle" | "loading" | "expired" } | { status: "error"; message: string } | ReadyLocation;

export function AttendanceEventForm({ mode, attendanceId, disabled = false, onPendingChange }: {
  mode: "check-in" | "check-out";
  attendanceId?: string;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const checkingOut = mode === "check-out";
  const label = checkingOut ? "Check Out" : "Check In";
  const router = useRouter();
  const [location, setLocation] = useState<AttendanceLocationState>({ status: "idle" });
  const current = useRef<ReadyLocation | null>(null);
  const generation = useRef(0);
  const acquiring = useRef(false);
  const [remaining, setRemaining] = useState(0);
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState("");
  const [attendance, setAttendance] = useState<AttendanceDto | null>(null);

  const clearEvidence = useCallback((status: "idle" | "loading" | "expired") => {
    generation.current++;
    acquiring.current = false;
    current.current = null;
    setLocation({ status });
    setRemaining(0);
  }, []);
  const isFresh = useCallback(() => {
    if (!current.current) return false;
    if (performance.now() >= current.current.deadline) { clearEvidence("expired"); return false; }
    return true;
  }, [clearEvidence]);
  useEffect(() => {
    clearEvidence("idle");
    return () => { generation.current++; current.current = null; acquiring.current = false; };
  }, [mode, attendanceId, clearEvidence]);
  useEffect(() => {
    if (location.status !== "ready") return;
    const tick = () => { if (isFresh()) setRemaining(Math.max(0, Math.ceil((location.deadline - performance.now()) / 1000))); };
    const timer = setInterval(tick, 1000);
    const expiry = setTimeout(() => clearEvidence("expired"), Math.max(0, location.deadline - performance.now()));
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); clearTimeout(expiry); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [location, isFresh, clearEvidence]);

  async function acquireLocation() {
    if (submitting.current || acquiring.current || disabled) return;
    clearEvidence("loading");
    acquiring.current = true;
    const request = generation.current;
    setMessage("");
    try {
      const evidence = await getLocation();
      const acquiredAt = Date.now();
      const requestStartedAt = performance.now();
      const acquisitionDeadline = requestStartedAt + ATTENDANCE_LOCATION_MAX_AGE_MS;
      if (request !== generation.current) return;
      const result = await prepareAttendanceLocationAction({ ...evidence, acquiredAt,
        ...(checkingOut ? { event: "CHECK_OUT", attendanceId } : { event: "CHECK_IN" }) });
      if (request !== generation.current) return;
      if (!result.success || !result.data) {
        if (result.locationError === "expired") clearEvidence("expired");
        else setLocation({ status: "error", message: result.message });
        return;
      }
      // Conservatively include the entire action round trip in the server's remaining budget.
      // Countdown/deadline never depend on subsequent device wall-clock changes.
      const deadline = Math.min(acquisitionDeadline, requestStartedAt + result.data.remainingMilliseconds);
      if (performance.now() >= deadline) { clearEvidence("expired"); return; }
      const value: ReadyLocation = { status: "ready", evidence, receipt: result.data.receipt,
        address: result.data.address, expiresAt: result.data.expiresAt, deadline };
      current.current = value;
      setLocation(value);
      setRemaining(Math.ceil((deadline - performance.now()) / 1000));
    } catch (error) {
      if (request === generation.current) setLocation({ status: "error", message: error instanceof Error ? error.message : "Unable to get your location." });
    } finally {
      if (request === generation.current) acquiring.current = false;
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || disabled || !isFresh() || !current.current) return;
    const prepared = current.current;
    submitting.current = true;
    setPending(true);
    onPendingChange?.(true);
    setMessage("");
    try {
      const result = await (checkingOut ? checkOutAction : checkInAction)({ ...prepared.evidence, locationReceipt: prepared.receipt, description, ...(checkingOut ? { attendanceId } : {}) });
      if (result.success && result.data) {
        clearEvidence("idle");
        setAttendance(result.data);
        setMessage(result.message);
      } else {
        if (result.locationError) clearEvidence(result.locationError === "expired" ? "expired" : "idle");
        else isFresh();
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
            {location.status === "expired" && <p role="status">Location expired. Get your location again.</p>}
            {location.status === "ready" && <><p className="font-medium text-teal-800">Location detected</p>
              <p>Location valid for {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</p>
              <p>{location.address ?? "Address unavailable. GPS coordinates remain valid."}</p>
              {location.address && <GeocodingAttribution />}
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
