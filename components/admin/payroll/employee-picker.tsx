"use client";

import { useEffect, useState } from "react";
import { listUsersAction } from "@/actions/users";
import type { UserListDto } from "@/types/user";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function EmployeePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<UserListDto | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedName, setSelectedName] = useState("");
  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const response = await listUsersAction({ search, page, pageSize: 10, role: "USER", isActive: true, sort: "name", order: "asc" });
        if (!live) return;
        if (response.success && response.data) setResult(response.data);
        else setError("Pilihan karyawan tidak dapat dimuat. Pastikan sesi ADMIN masih aktif.");
      } catch { if (live) setError("Pilihan karyawan tidak dapat dimuat."); }
      finally { if (live) setLoading(false); }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [search, page]);
  function changePage(next: number) { setLoading(true); setError(""); setPage(next); }
  return <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Karyawan aktif (USER)</legend>
    <label className="block space-y-1 text-sm"><span>Cari nama atau email</span><Input maxLength={100} value={search} onChange={e => { setLoading(true); setError(""); setSearch(e.target.value); setPage(1); }} /></label>
    {value && <p className="text-sm font-medium">Dipilih: {selectedName}</p>}
    {loading ? <p role="status" className="text-sm">Memuat karyawan…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <>
      <div className="space-y-1">{result?.items.map(user => <label key={user.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
        <input type="radio" name="payroll-employee" value={user.id} checked={value === user.id} onChange={() => { onChange(user.id); setSelectedName(user.name); }} />
        <span className="min-w-0 break-words">{user.name}<span className="block text-xs text-muted-foreground">{user.email}</span></span>
      </label>)}{!result?.items.length && <p className="text-sm text-muted-foreground">Tidak ada karyawan yang sesuai.</p>}</div>
      <div className="flex items-center gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => changePage(page - 1)}>Sebelumnya</Button><span className="text-xs">{page}</span><Button type="button" variant="outline" className="min-h-11" disabled={!result || page * 10 >= result.total} onClick={() => changePage(page + 1)}>Berikutnya</Button></div>
    </>}
  </fieldset>;
}
