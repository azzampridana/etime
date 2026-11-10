"use client";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-3"><p>Employees tidak dapat dimuat.</p><Button onClick={reset}>Muat ulang</Button></div>;
}
