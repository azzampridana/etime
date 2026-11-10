"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SlipDialog } from "./slip-dialog";
import { InitializeButton } from "./initialize-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { months, period, selectClass, Status, money, payrollRequest, PayrollHttpError, type PayrollList } from "./shared";

export function PayrollListView({ query }: { query: string }) {
  const router = useRouter();
  const [result, setResult] = useState<PayrollList | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [periodDirty, setPeriodDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const params = new URLSearchParams(query);
  async function refresh() {
    try { const data = await payrollRequest<PayrollList>(`?${query}`); setResult(data); setError(""); }
    catch (failure) { setError("Daftar gagal diperbarui. Muat ulang sebelum melanjutkan."); throw failure; }
  }
  useEffect(() => {
    let live = true;
    payrollRequest<PayrollList>(`?${query}`).then(data => { if (live) setResult(data); }).catch(failure => {
      if (live) setError(failure instanceof PayrollHttpError ? failure.message : "Daftar Payroll tidak dapat dimuat.");
    });
    return () => { live = false; };
  }, [query, reload]);
  function pageHref(page: number) { const next = new URLSearchParams(query); next.set("page", String(page)); return `/admin/payroll?${next}`; }
  return <div className="space-y-3" onClickCapture={event => { if (generating && event.target instanceof Element && event.target.closest("a")) { event.preventDefault(); event.stopPropagation(); } }}>
    <div className="flex flex-wrap items-start justify-between gap-3"><p className="text-sm text-muted-foreground">Pilih periode, siapkan draft, lalu isi nominal setiap karyawan.</p><div className="flex min-w-0 flex-wrap items-start gap-2"><Button asChild variant="outline" className="min-h-11"><Link href="/admin/payroll/components"><ListChecks aria-hidden="true" className="size-4" />Komponen Mandatory</Link></Button><InitializeButton year={Number(params.get("year"))} month={Number(params.get("month"))} refresh={refresh} disabled={periodDirty} onBusy={setGenerating} /></div></div>
    <Card><CardContent><form onChange={() => setPeriodDirty(true)} onSubmit={event => {
      event.preventDefault(); const fields = new FormData(event.currentTarget); const next = new URLSearchParams();
      for (const name of ["year", "month", "status"]) { const value = fields.get(name); if (typeof value === "string" && value) next.set(name, value); }
      if (["year", "month", "status"].every(name => (next.get(name) ?? "") === (params.get(name) ?? ""))) setPeriodDirty(false);
      router.push(`/admin/payroll?${next}`);
    }}><fieldset disabled={generating} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1 text-sm"><span>Tahun</span><Input required name="year" type="number" min={2000} max={2100} defaultValue={params.get("year") ?? ""} className="min-h-11" /></label>
      <label className="space-y-1 text-sm"><span>Bulan</span><select required name="month" defaultValue={params.get("month") ?? ""} className={selectClass}>{months.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>Status</span><select name="status" defaultValue={params.get("status") ?? ""} className={selectClass}><option value="">Semua status</option><option>DRAFT</option><option>PUBLISHED</option></select></label>
      <div className="flex gap-2"><Button className="min-h-11" type="submit">Terapkan</Button><Button asChild className="min-h-11" variant="outline"><Link href="/admin/payroll">Reset</Link></Button></div>
    </fieldset></form></CardContent></Card>
    <p className="text-sm font-medium">Periode aktif: {period({ year: Number(params.get("year")), month: Number(params.get("month")) })}. Klik Terapkan setelah mengubah selector.</p>
    {periodDirty && <p className="text-sm text-muted-foreground">Terapkan pilihan terlebih dahulu untuk mengaktifkan Generate.</p>}
    {notice && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{notice}</p>}
    <label className="block space-y-1 text-sm"><span>Cari karyawan pada halaman yang dimuat saja</span><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nama karyawan" /></label>
    {error ? <div role="alert" className="space-y-3 rounded-xl border p-4"><p className="text-sm text-destructive">{error}</p><Button variant="outline" className="min-h-11" onClick={() => { setError(""); setResult(null); setReload(value => value + 1); }}>Muat ulang</Button></div> : !result ? <p role="status">Memuat Payroll…</p> : <>
      {!result.items.filter(row => row.employeeNameSnapshot.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID"))).length ? <Card><CardContent className="py-6 text-center"><h2 className="font-semibold">Tidak ada slip yang sesuai pada halaman ini</h2><p className="mt-2 text-sm text-muted-foreground">Ubah pencarian/filter atau generate draft untuk periode aktif.</p></CardContent></Card> : <div role="region" aria-label="Daftar Payroll, geser horizontal pada layar sempit" tabIndex={0} className="overflow-x-auto rounded-lg border bg-card focus-visible:outline-2 focus-visible:outline-ring"><table className="w-full min-w-[860px] text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>{["Employee", "Status", "Total Earnings", "Total Deductions", "THP", "Action"].map(label => <th scope="col" key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody className="divide-y">{result.items.filter(row => row.employeeNameSnapshot.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID"))).map(row => <tr key={row.id} className="hover:bg-muted/30">
        <td className="max-w-64 px-3 py-1.5"><p className="break-words font-medium">{row.employeeNameSnapshot}</p><p className="text-[11px] text-muted-foreground">Diubah {new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(row.updatedAt))} WIB</p></td>
        <td className="px-3 py-1.5"><Status status={row.status} /></td>
        {[row.totalEarnings, row.totalDeductions, row.takeHomePay].map((value, i) => <td key={i} className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${i === 2 ? "font-semibold" : ""}`}>{money(value)}</td>)}
        <td className="px-3 py-1.5"><Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setSelected(row.id)} aria-label={`${row.status === "DRAFT" ? "Edit" : "Lihat"} slip ${row.employeeNameSnapshot}`}>{row.status === "DRAFT" ? "Edit" : "Lihat"}</Button></td>
      </tr>)}</tbody></table></div>}
      <nav aria-label="Pagination Payroll" className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>Halaman {result.page} · {result.total} slip</span><div className="flex gap-2">{result.page > 1 && <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(result.page - 1)}>Sebelumnya</Link></Button>}{result.page * result.pageSize < result.total && <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(result.page + 1)}>Berikutnya</Link></Button>}</div></nav>
    </>}
    {selected && <SlipDialog key={selected} id={selected} onChanged={refresh} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setNotice("Draft berhasil disimpan."); void refresh().catch(() => setNotice("Draft tersimpan, tetapi refresh gagal. Muat ulang daftar.")); }} />}
  </div>;
}
