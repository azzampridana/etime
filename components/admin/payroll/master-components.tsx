"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { toPayrollComponent } from "@/mappers/payroll-component.mapper";
import { createPayrollComponentSchema, updatePayrollComponentSchema } from "@/schemas/payroll-component.schema";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { payrollRequest, PayrollHttpError, selectClass } from "./shared";

type Component = ReturnType<typeof toPayrollComponent>;
type Result = { items: Component[]; total: number; page: number; pageSize: number };
export function MasterComponents() {
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Component | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    payrollRequest<Result>(`?page=${page}&pageSize=20${filter ? `&isActive=${filter}` : ""}`, "GET", undefined, "payroll-components").then(data => { if (live) setResult(data); }).catch(e => { if (live) setError(e instanceof PayrollHttpError ? e.message : "Master tidak dapat dimuat."); });
    return () => { live = false; };
  }, [page, filter, revision]);
  function refresh() { setError(""); setResult(null); setRevision(value => value + 1); }
  return <div className="space-y-3">
    {!editing && <div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="min-h-11"><Link href="/admin/payroll">Kembali ke Payroll</Link></Button><Button className="min-h-11" onClick={() => setEditing("new")}>Tambah komponen</Button></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {editing ? <MasterForm key={editing === "new" ? "new" : `${editing.id}:${editing.version}`} initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage("Komponen berhasil disimpan. Slip existing tidak berubah."); refresh(); }} /> : <>
      <label className="block space-y-1 text-sm"><span>Status master</span><select className={selectClass} value={filter} onChange={e => { setResult(null); setError(""); setFilter(e.target.value); setPage(1); }}><option value="">Aktif dan nonaktif</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
      {error ? <div role="alert"><p className="text-destructive">{error}</p><Button variant="outline" className="min-h-11" onClick={refresh}>Muat ulang</Button></div> : !result ? <p role="status">Memuat komponen…</p> : <>
        {!result.items.length && <p className="rounded-xl border p-5 text-sm">Belum ada komponen pada halaman ini.</p>}
        <ul className="space-y-2">{result.items.map(row => <li key={row.id}><Card size="sm"><CardContent className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{row.name}</h2><p className="text-sm text-muted-foreground">{row.category} · Urutan {row.sortOrder} · {row.isActive ? "Aktif / mandatory" : "Nonaktif"}</p></div><Button variant="outline" className="min-h-11" onClick={() => setEditing(row)}>Kelola</Button></CardContent></Card></li>)}</ul>
        <nav className="flex flex-wrap items-center gap-3" aria-label="Pagination master"><Button className="min-h-11" variant="outline" disabled={page <= 1} onClick={() => { setResult(null); setPage(page - 1); }}>Sebelumnya</Button><span className="text-sm">{page} · {result.total} komponen</span><Button className="min-h-11" variant="outline" disabled={page * result.pageSize >= result.total} onClick={() => { setResult(null); setPage(page + 1); }}>Berikutnya</Button></nav>
      </>}
    </>}
  </div>;
}

function MasterForm({ initial, onClose, onSaved }: { initial?: Component; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "EARNING");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = useRef(false);
  const confirmation = useConfirmDialog();
  const [confirmationMutation, setConfirmationMutation] = useState(false);
  const leaving = useRef(false);
  function discard(description: string, action: () => void) { setConfirmationMutation(false); confirmation.request({ title: "Buang perubahan?", description, variant: "warning", confirmLabel: "Buang perubahan", cancelLabel: "Continue Editing", onConfirm: () => { leaving.current = true; action(); } }); }
  const changed = name !== (initial?.name ?? "") || category !== (initial?.category ?? "EARNING") || sortOrder !== String(initial?.sortOrder ?? 0) || isActive !== (initial?.isActive ?? true);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (!leaving.current && (changed || busy.current)) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (busy.current || changed) { event.preventDefault(); event.stopPropagation();
        if (!busy.current && anchor instanceof HTMLAnchorElement) discard("Buang perubahan master yang belum disimpan?", () => window.location.assign(anchor.href));
      }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [changed]);
  async function save(event?: FormEvent, confirmed = false) {
    event?.preventDefault(); if (busy.current || blocked) return false;
    const input = { name, category, sortOrder: sortOrder === "" ? NaN : Number(sortOrder), isActive };
    const parsed = initial ? updatePayrollComponentSchema.safeParse({ ...input, version: initial.version }) : createPayrollComponentSchema.safeParse(input);
    if (!parsed.success) { const next: Record<string, string> = {}; for (const issue of parsed.error.issues) next[issue.path.join(".")] = issue.message; setErrors(next); return; }
    if (initial?.isActive && !isActive && !confirmed) { setConfirmationMutation(true); confirmation.request({ title: "Nonaktifkan komponen?", description: "Nonaktifkan komponen untuk draft baru? Slip existing tidak berubah.", variant: "warning", confirmLabel: "Nonaktifkan", onConfirm: () => save(undefined, true) }); return false; }
    busy.current = true; setPending(true); setErrors({}); setMessage("");
    try { await payrollRequest(initial ? `/${initial.id}` : "", initial ? "PUT" : "POST", parsed.data, "payroll-components"); onSaved(); }
    catch (e) { setMessage(e instanceof PayrollHttpError && e.status === 409 ? "Nama kategori sudah digunakan (termasuk nonaktif), atau versi berubah. Muat ulang sebelum melanjutkan." : e instanceof PayrollHttpError ? e.message : "Hasil belum dapat dipastikan."); setBlocked(!(e instanceof PayrollHttpError) || e.status !== 400); return false; }
    finally { busy.current = false; setPending(false); }
  }
  return <Card size="sm"><CardContent><form onSubmit={save} className="space-y-3"><h2 className="font-semibold">{initial ? "Kelola komponen" : "Komponen baru"}</h2>
    <fieldset disabled={pending || blocked} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm"><span>Nama</span><Input value={name} maxLength={200} onChange={e => setName(e.target.value)} aria-invalid={!!errors.name} />{errors.name && <span className="text-destructive">{errors.name}</span>}</label>
      <label className="space-y-1 text-sm"><span>Kategori</span><select className={selectClass} value={category} onChange={e => setCategory(e.target.value === "DEDUCTION" ? "DEDUCTION" : "EARNING")}><option>EARNING</option><option>DEDUCTION</option></select></label>
      <label className="space-y-1 text-sm"><span>Urutan (0–9999)</span><Input type="number" value={sortOrder} min={0} max={9999} onChange={e => setSortOrder(e.target.value)} aria-invalid={!!errors.sortOrder} />{errors.sortOrder && <span className="text-destructive">{errors.sortOrder}</span>}</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />Aktif (mandatory untuk draft baru)</label>
    </fieldset>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={pending || blocked} className="min-h-11">{pending ? "Menyimpan…" : "Simpan komponen"}</Button><Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => { if (!changed) onClose(); else discard("Buang perubahan yang belum disimpan?", onClose); }}>Batal</Button>{blocked && <Button type="button" variant="outline" className="min-h-11" onClick={() => { discard("Muat ulang master? Perubahan lokal akan dibuang.", () => window.location.reload()); }}>Muat ulang</Button>}</div>
    {confirmation.dialog(message, confirmationMutation && blocked)}
  </form></CardContent></Card>;
}
