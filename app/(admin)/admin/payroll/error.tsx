"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Payroll tidak dapat ditampilkan</h2><p className="text-sm text-muted-foreground">Muat ulang halaman. Jika baru menyimpan, periksa hasilnya sebelum mengulangi operasi.</p><Button className="min-h-11" variant="outline" onClick={reset}>Coba muat ulang</Button></div>;
}
