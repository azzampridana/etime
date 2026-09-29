"use client";
/* Object URLs are local camera previews, not public optimized images. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { acquireLocation, type LocationEvidence } from "@/lib/geolocation/acquire-location";
import { OVERTIME_LOCATION_MAX_AGE_MS } from "@/schemas/overtime.schema";
import { overtimeCheckInAction, overtimeCheckOutAction, prepareOvertimeLocationAction } from "@/actions/overtime";
import { DirectCamera } from "@/components/overtime/direct-camera";
import { GeocodingAttribution } from "@/components/shared/geocoding-attribution";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Snapshot = { evidence: LocationEvidence; receipt: string; address: string | null; expiresAt: number; deadline: number };
export function OvertimeEventForm({ mode }: { mode: "check-in" | "check-out" }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "expired" | "error">("idle");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current = useRef<Snapshot | null>(null);
  const generation = useRef(0);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [retaking, setRetaking] = useState(false);
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const label = mode === "check-in" ? "Overtime Check In" : "Overtime Check Out";

  const clearEvidence = useCallback((next: "idle" | "expired" | "loading") => {
    generation.current++;
    current.current = null;
    setSnapshot(null); setPhoto(null); setPreview(""); setCapturedAt(""); setRetaking(false); setRemaining(0); setStatus(next);
  }, []);
  const isFresh = useCallback(() => {
    const value = current.current;
    if (!value) return false;
    if (Date.now() >= value.expiresAt || performance.now() >= value.deadline) { clearEvidence("expired"); return false; }
    return true;
  }, [clearEvidence]);
  useEffect(() => () => { generation.current++; current.current = null; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!snapshot) return;
    const tick = () => { if (isFresh()) setRemaining(Math.max(0, Math.ceil(Math.min(snapshot.expiresAt - Date.now(), snapshot.deadline - performance.now()) / 1000))); };
    const timer = setInterval(tick, 1000);
    const expiry = setTimeout(() => clearEvidence("expired"), Math.max(0, Math.min(snapshot.expiresAt - Date.now(), snapshot.deadline - performance.now())));
    window.addEventListener("focus", tick); document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); clearTimeout(expiry); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [snapshot, isFresh, clearEvidence]);

  async function locate() {
    if (submitting.current || status === "loading") return;
    clearEvidence("loading"); setMessage("");
    const request = generation.current;
    try {
      const evidence = await acquireLocation();
      const acquiredAt = Date.now();
      const deadline = performance.now() + OVERTIME_LOCATION_MAX_AGE_MS;
      if (request !== generation.current) return;
      const result = await prepareOvertimeLocationAction({ ...evidence, acquiredAt, event: mode });
      if (request !== generation.current) return;
      if (!result.success || !result.data) { setStatus("error"); setMessage(result.message); return; }
      if (Date.now() >= result.data.expiresAt || performance.now() >= deadline) { clearEvidence("expired"); return; }
      const value = { evidence, deadline, ...result.data };
      current.current = value; setSnapshot(value); setStatus("ready");
      setRemaining(Math.ceil(Math.min(value.expiresAt - Date.now(), value.deadline - performance.now()) / 1000));
    } catch (error) {
      if (request !== generation.current) return;
      setStatus("error"); setMessage(error instanceof Error ? error.message : "Unable to get your location. Try again.");
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !isFresh() || !current.current || !photo || !description.trim()) return;
    submitting.current = true; setPending(true); setMessage("");
    const data = new FormData();
    for (const [key, value] of Object.entries(current.current.evidence)) data.set(key, String(value));
    data.set("locationReceipt", current.current.receipt);
    data.set("description", description); data.set("photo", photo);
    try {
      const result = await (mode === "check-in" ? overtimeCheckInAction : overtimeCheckOutAction)(data);
      setMessage([result.message, ...Object.values(result.fieldErrors ?? {}).flat()].join(" "));
      if (result.success) { clearEvidence("idle"); setDescription(""); }
      else { isFresh(); }
      router.refresh();
    } catch { setMessage("Unable to reach the server. Check your connection and try again."); }
    finally { submitting.current = false; setPending(false); }
  }
  return <Card className="min-w-0"><CardHeader><h2 className="text-lg font-semibold">{label}</h2><p className="text-sm text-muted-foreground">Get location, describe your work, then take an evidence photo.</p></CardHeader><CardContent>
    <form onSubmit={submit} className="min-w-0 space-y-5" aria-busy={pending}>
      <section className="space-y-3 [overflow-wrap:anywhere]" aria-label="Event location"><h3 className="font-medium">Location</h3><div aria-live="polite">
        {status === "idle" && <p>Get your location to enable the camera.</p>}
        {status === "loading" && <p>Detecting and preparing your location…</p>}
        {status === "error" && <p>Location could not be prepared. Please try again.</p>}
        {status === "expired" && <><p className="font-semibold text-amber-900">Location expired</p><p>Your location session has expired. Please get your location again and capture a new photo.</p></>}
        {snapshot && <><p className="font-medium text-teal-800">Location ready</p>
          {snapshot.address && <div><p>{snapshot.address}</p><GeocodingAttribution /></div>}
          <p className="text-sm">{snapshot.evidence.latitude}, {snapshot.evidence.longitude} · ±{snapshot.evidence.accuracy} m</p><p className="text-sm">{snapshot.evidence.timezone}</p></>}
      </div>
        {snapshot && <p className="text-xs text-muted-foreground">Location valid for {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</p>}
        <Button type="button" variant="outline" className="min-h-12 w-full" disabled={pending || status === "loading"} onClick={locate}>{snapshot ? "Refresh Location" : "Get Location"}</Button>
      </section>
      <div className="space-y-2"><Label htmlFor={`${mode}-description`}>Description (required)</Label><textarea id={`${mode}-description`} required maxLength={1000} rows={4} value={description} onChange={event => setDescription(event.target.value)} disabled={pending} className="w-full rounded-lg border bg-background p-3 text-base" /></div>
      <section className="min-w-0 space-y-3" aria-label="Photo evidence"><h3 className="font-medium">Photo Evidence (required)</h3>
        {!snapshot && <><p className="text-sm text-muted-foreground">A fresh location is required before opening the camera.</p><Button type="button" variant="outline" disabled className="min-h-12 w-full">Open Camera</Button></>}
        {snapshot && !photo && <DirectCamera key={snapshot.receipt} disabled={pending} startOnMount={retaking} isFresh={isFresh} onCapture={file => {
          if (!isFresh()) return;
          setPhoto(file); setPreview(URL.createObjectURL(file)); setCapturedAt(new Date().toISOString()); setRetaking(false);
        }} />}
        {snapshot && photo && preview && <>
          <div className="relative overflow-hidden rounded-lg bg-black">
            <img src={preview} alt="Captured overtime evidence, not yet saved" className="max-h-[32rem] w-full object-contain" />
            <div className="absolute inset-x-0 bottom-0 space-y-0.5 bg-black/75 p-2 text-xs text-white [overflow-wrap:anywhere]">
              <p className="font-semibold">{mode === "check-in" ? "OVERTIME CHECK-IN" : "OVERTIME CHECK-OUT"}</p>
              <p>{formatAdminEventTime(capturedAt, snapshot.evidence.timezone)}</p>
              {snapshot.address && <p className="line-clamp-2">{snapshot.address}</p>}
              <p>{snapshot.evidence.latitude}, {snapshot.evidence.longitude} · ±{snapshot.evidence.accuracy} m</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Preview only. The saved photo uses the official server event time and watermark.</p>
          <Button type="button" variant="outline" className="min-h-12 w-full" disabled={pending} onClick={() => {
            if (!isFresh()) return;
            setPhoto(null); setPreview(""); setCapturedAt(""); setRetaking(true);
          }}>Retake Photo</Button>
        </>}
      </section>
      {message && <p role="status" className="break-words">{message}</p>}
      <Button type="submit" className="min-h-12 w-full" disabled={pending || !snapshot || !description.trim() || !photo}>{pending ? "Saving overtime…" : label}</Button>
    </form>
  </CardContent></Card>;
}
