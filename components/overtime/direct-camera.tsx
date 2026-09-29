"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_PHOTO_INPUT_BYTES } from "@/schemas/overtime.schema";

type CameraFacing = "environment" | "user";

export function DirectCamera({ disabled, isFresh, onCapture, startOnMount = false }: {
  disabled: boolean; isFresh: () => boolean; onCapture: (photo: File) => void; startOnMount?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const requesting = useRef(false);
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [state, setState] = useState<"idle" | "requesting" | "ready" | "capturing" | "error">("idle");
  const [message, setMessage] = useState("");

  function stop() {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
  useEffect(() => () => { generation.current++; stream.current?.getTracks().forEach(track => track.stop()); }, []);
  useEffect(() => {
    // Only a deliberate Retake click mounts with this flag; ordinary mount never opens a camera.
    if (startOnMount) void start();
    // This is a mount-only user intent, not a request to restart when props render again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(alternative?: CameraFacing) {
    if (disabled || !isFresh() || requesting.current) return;
    const previousDevice = stream.current?.getVideoTracks()[0]?.getSettings().deviceId;
    const requestedFacing = alternative ?? facing;
    const request = ++generation.current;
    stop(); setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error"); setMessage("Camera is unavailable. Use HTTPS (or localhost) and a browser with camera support."); return;
    }
    setState("requesting");
    requesting.current = true;
    try {
      let camera: MediaStream;
      let selectedFacing = requestedFacing;
      try { camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: alternative ? { exact: requestedFacing } : { ideal: requestedFacing }, width: { ideal: 1600 }, height: { ideal: 1200 } } }); }
      catch (error) {
        if (!(error instanceof DOMException) || !["OverconstrainedError", "NotFoundError", "NotReadableError"].includes(error.name)) throw error;
        if (request !== generation.current || !isFresh()) return;
        camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: alternative
          ? previousDevice ? { deviceId: { exact: previousDevice } } : { facingMode: { ideal: facing } }
          : true });
        selectedFacing = facing;
        if (alternative) setMessage("The other camera is unavailable. Your previous camera has been reopened.");
      }
      if (request !== generation.current || !isFresh() || !video.current) { camera.getTracks().forEach(track => track.stop()); return; }
      stream.current = camera;
      const actualFacing = camera.getVideoTracks()[0]?.getSettings().facingMode;
      setFacing(actualFacing === "user" || actualFacing === "environment" ? actualFacing : selectedFacing);
      camera.getVideoTracks().forEach(track => track.addEventListener("ended", () => {
        if (request === generation.current) { stop(); setState("error"); setMessage("Camera disconnected. Please try again."); }
      }, { once: true }));
      video.current.srcObject = camera;
      await video.current.play();
      if (request !== generation.current) return;
      if (!isFresh()) { stop(); return; }
      setState("ready");
    } catch (error) {
      if (request !== generation.current) return;
      stop(); setState("error");
      setMessage(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser settings, then retry."
        : "Unable to open the camera. Check that a camera is connected and not in use by another app, then retry.");
    } finally {
      requesting.current = false;
    }
  }

  async function capture() {
    if (disabled || !isFresh() || state !== "ready" || !video.current) return;
    const request = generation.current;
    const { videoWidth: width, videoHeight: height } = video.current;
    if (width < 240 || height < 180) { setMessage("Wait for a clear camera frame, or try another camera."); return; }
    setState("capturing");
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(width, height));
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      stop();
      if (request !== generation.current || !isFresh()) return;
      if (!blob || !blob.size || blob.size > MAX_PHOTO_INPUT_BYTES) throw new Error();
      onCapture(new File([blob], "overtime-camera.jpg", { type: "image/jpeg" }));
    } catch {
      if (request !== generation.current) return;
      stop(); setState("error"); setMessage("Photo capture failed. Please open the camera and try again.");
    }
  }

  return <div className="space-y-3">
    {/* Mirror only the preview; drawImage captures the original, untransformed video frame. */}
    <video ref={video} autoPlay muted playsInline aria-label="Live camera preview" style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} className={`max-h-80 w-full rounded-lg bg-black object-contain ${state === "ready" || state === "requesting" || state === "capturing" ? "" : "hidden"}`} />
    <p role="status" className="text-sm">{state === "requesting" ? "Requesting camera access…" : message || (state === "ready" ? "Camera ready." : "Open the camera to take your evidence photo.")}</p>
    {state === "ready" ? <Button type="button" className="min-h-12 w-full" disabled={disabled} onClick={capture}>Capture Photo</Button>
      : <Button type="button" variant="outline" className="min-h-12 w-full" disabled={disabled || state === "requesting" || state === "capturing"} onClick={() => void start()}>{state === "capturing" ? "Capturing…" : state === "error" ? "Retry Camera" : "Open Camera"}</Button>}
    {state === "ready" && <Button type="button" variant="outline" className="min-h-11 w-full" disabled={disabled} onClick={() => void start(facing === "environment" ? "user" : "environment")}>Switch Camera</Button>}
    {(state === "requesting" || state === "ready") && <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => { generation.current++; stop(); setState("idle"); }}>Close Camera</Button>}
  </div>;
}
