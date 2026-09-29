"use client";
/* Private evidence uses authenticated routes rather than the public image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

export function EvidencePhoto({ url, alt }: { url: string; alt: string }) {
  const [unavailable, setUnavailable] = useState(false);
  return <div className="space-y-2">
    {unavailable ? <p role="status">Photo evidence is unavailable.</p> : <a href={url} target="_blank" rel="noreferrer" className="block"><img src={url} alt={alt} onError={() => setUnavailable(true)} className="h-auto w-full rounded-lg" loading="lazy" /></a>}
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">Open photo</a>
  </div>;
}
