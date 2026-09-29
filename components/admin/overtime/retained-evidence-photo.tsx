"use client";
/* Private evidence is fetched through the authenticated endpoint, never an optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

export function RetainedEvidencePhoto({ url, alt }: { url: string; alt: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("Loading photo…");
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) {
          if (!controller.signal.aborted) setMessage(response.status === 404 ? "Photo no longer available." : "Unable to load photo. Please reopen the detail to try again.");
          return;
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPhoto(objectUrl);
      } catch {
        if (!controller.signal.aborted) setMessage("Unable to load photo. Please reopen the detail to try again.");
      }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return photo ? <div className="space-y-2"><img src={photo} alt={alt} className="h-auto w-full rounded-lg" onError={() => { setPhoto(null); setMessage("Photo preview unavailable."); }} /><a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Open photo</a></div>
    : <p role="status" className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{message}</p>;
}
