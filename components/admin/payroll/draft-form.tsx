"use client";

import { useEffect, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { LockKeyhole, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createPayrollDraftSchema, updatePayrollDraftSchema } from "@/schemas/payroll.schema";
import { EmployeePicker } from "./employee-picker";
import { months, period, selectClass, CategoryBadge, categoryColors, Totals, payrollRequest, PayrollHttpError, type PayrollDetail } from "./shared";

type Item = Omit<PayrollDetail["items"][number], "id"> & { id?: string; uiKey: string };
function availableOrder(rows: Item[], category: Item["category"]) {
  const used = new Set(rows.filter(row => row.category === category).map(row => row.sortOrder));
  let order = 0;
  while (used.has(order)) order++;
  return order;
}
const maxAmount = BigInt("999999999999999999");
const leaveMessage = "Perubahan belum disimpan. Tinggalkan halaman ini?";

export type DraftCloseGuard = { canClose: () => boolean };
export function DraftForm({ initial, onSaved, onClose, closeGuard, onPublished }: { initial?: PayrollDetail; onSaved?: () => void; onClose?: () => void; closeGuard?: Ref<DraftCloseGuard>; onPublished?: (row: PayrollDetail) => void }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [version, setVersion] = useState(initial?.version);
  const [bankNotice, setBankNotice] = useState("");
  const initialItems = useRef<Item[]>(initial?.items.map(item => ({ ...item, uiKey: item.id })) ?? []);
  const nextLocalKey = useRef(0);
  const [items, setItems] = useState<Item[]>(initialItems.current);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const confirmation = useConfirmDialog();
  const requestConfirmation = confirmation.request;
  const [confirmationMutation, setConfirmationMutation] = useState(false);
  const dirty = useRef(false);
  const historyGuardInstalled = useRef(false);
  const initialState = useRef(JSON.stringify({ userId: "", year: "", month: "", bankName: initial?.bankName ?? "", accountNumber: initial?.accountNumber ?? "", items: initialItems.current }));
  const currentState = JSON.stringify({ userId, year, month, bankName, accountNumber, items });
  useImperativeHandle(closeGuard, () => ({ canClose: () => {
    if (busy.current || confirmation.isOpen()) return false;
    if (currentState === initialState.current) return true;
    discard(leaveMessage, () => { dirty.current = false; onClose?.(); });
    return false;
  } }));
  useEffect(() => { dirty.current = currentState !== initialState.current; }, [currentState]);
  useEffect(() => {
    // One same-URL history entry permits canceling browser Back without losing form state.
    if (!historyGuardInstalled.current) { history.pushState(history.state, "", location.href); historyGuardInstalled.current = true; }
    let skipping = false;
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current || busy.current) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (busy.current || dirty.current) {
        event.preventDefault(); event.stopPropagation();
        if (!busy.current && anchor instanceof HTMLAnchorElement) discard(leaveMessage, () => { dirty.current = false; window.location.assign(anchor.href); });
      }
    };
    const back = () => {
      if (skipping) { skipping = false; return; }
      if (busy.current || dirty.current) { skipping = true; history.go(1);
        if (!busy.current) discard(leaveMessage, () => { dirty.current = false; history.back(); });
      } else { dirty.current = false; skipping = true; history.back(); }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("popstate", back);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("popstate", back); document.removeEventListener("click", click, true); };
  }, []);
  let earnings = BigInt(0), deductions = BigInt(0);
  let previewError = "";
  for (const item of items) {
    if (!/^(0|[1-9]\d{0,17})$/.test(item.amount.trim())) { previewError = "Nominal harus rupiah bulat nonnegatif, maksimal 18 digit."; continue; }
    if (item.category === "EARNING") earnings += BigInt(item.amount.trim()); else deductions += BigInt(item.amount.trim());
  }
  if (earnings > maxAmount || deductions > maxAmount) previewError = "Total melampaui batas 18 digit.";
  if (deductions > earnings) previewError = "Total deductions tidak boleh melebihi earnings.";
  const error = (path: string) => errors[path] ? <span id={`error-${path}`} className="block text-xs text-destructive" role="alert">{errors[path]}</span> : null;
  function changeItem(key: string, patch: Partial<Pick<Item, "name" | "category" | "amount">>) {
    setItems(rows => rows.map(row => {
      if (row.uiKey !== key) return row;
      if (row.origin === "MASTER") return patch.amount === undefined ? row : { ...row, amount: patch.amount };
      const category = patch.category ?? row.category;
      return { ...row, ...patch, sortOrder: category === row.category ? row.sortOrder : availableOrder(rows.filter(other => other.uiKey !== key), category) };
    }));
    setErrors({});
  }
  function discard(description: string, action: () => void) {
    setConfirmationMutation(false);
    requestConfirmation({ title: "Buang perubahan?", description, variant: "warning", confirmLabel: "Buang perubahan", cancelLabel: "Continue Editing", onConfirm: action });
  }
  function leave() {
    if (busy.current) return;
    const action = () => { dirty.current = false; if (onClose) onClose(); else router.push(initial ? `/admin/payroll/${initial.id}` : "/admin/payroll"); };
    if (dirty.current) discard(leaveMessage, action); else action();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || blocked) return;
    // DTO origin and local React keys are deliberately excluded from strict API input.
    const editable = { bankName, accountNumber, items: items.map(({ id, name, category, amount, sortOrder }) => ({
      ...(id ? { id } : {}), name, category, amount, sortOrder,
    })) };
    const parsed = initial ? updatePayrollDraftSchema.safeParse({ ...editable, version }) : createPayrollDraftSchema.safeParse({ ...editable, userId, year: Number(year), month: Number(month) });
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) nextErrors[issue.path.join(".")] = issue.message;
    setErrors(nextErrors);
    if (!parsed.success || previewError) { setMessage(previewError || "Periksa field yang ditandai."); return; }
    busy.current = true; setPending(true); setMessage("");
    try {
      const result = await payrollRequest<PayrollDetail>(initial ? `/${initial.id}` : "", initial ? "PUT" : "POST", parsed.data);
      dirty.current = false;
      if (onSaved) onSaved(); else { router.replace(`/admin/payroll/${result.id}?saved=1`); router.refresh(); }
    } catch (failure) {
      setMessage(failure instanceof PayrollHttpError ? failure.message : "Hasil belum dapat dipastikan. Muat ulang sebelum mencoba lagi.");
      setBlocked(!(failure instanceof PayrollHttpError) || failure.status !== 400);
    } finally { busy.current = false; setPending(false); }
  }
  async function publish() {
    if (!initial || busy.current || blocked || currentState !== initialState.current) return false;
    busy.current = true; setPending(true); setMessage("");
    let published: PayrollDetail;
    try {
      published = await payrollRequest<PayrollDetail>(`/${initial.id}/publish`, "POST", { version });
    } catch (failure) {
      setMessage(failure instanceof PayrollHttpError ? failure.message : "Hasil Publish belum pasti. Muat ulang sebelum mencoba lagi.");
      setBlocked(true); busy.current = false; setPending(false); return false;
    }
    dirty.current = false; busy.current = false; setPending(false);
    if (onPublished) onPublished(published);
    else { router.replace(`/admin/payroll/${published.id}`); router.refresh(); }
  }
  async function fillBank() {
    if (!initial || initial.status !== "DRAFT" || busy.current || blocked || currentState !== initialState.current) return false;
    const replaceExisting = Boolean(bankName || accountNumber);
    busy.current = true; setPending(true); setMessage(""); setBankNotice("");
    try {
      const response = await fetch(`/api/admin/payroll/${initial.id}/fill-bank`, { method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, replaceExisting }) });
      const body: unknown = await response.json();
      if (!response.ok) {
        // This API returns sanitized domain messages, including missing/incomplete Employee data.
        const detail = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "Bank snapshot could not be saved.";
        throw new PayrollHttpError(response.status, detail);
      }
      const result = z.object({ success: z.literal(true), data: z.object({ message: z.string(), slip: z.object({
        id: z.literal(initial.id), status: z.literal("DRAFT"), version: z.number().int().positive(),
        bankName: z.string().nullable(), accountNumber: z.string().nullable(),
      }) }) }).parse(body).data;
      const bank = result.slip.bankName ?? "", account = result.slip.accountNumber ?? "";
      setBankName(bank); setAccountNumber(account); setVersion(result.slip.version);
      initialState.current = JSON.stringify({ userId, year, month, bankName: bank, accountNumber: account, items });
      dirty.current = false; setBankNotice(result.message);
    } catch (failure) {
      setMessage(failure instanceof PayrollHttpError ? failure.message : "Hasil pengisian belum pasti. Muat ulang sebelum mencoba lagi.");
      setBlocked(!(failure instanceof PayrollHttpError) || failure.status !== 400);
      return false;
    } finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={save} className="space-y-3">
    {initial && <p className="text-xs text-muted-foreground">{initial.employeePositionSnapshot || "Jabatan tidak tercatat"}. MASTER: hanya nominal dapat diubah. CUSTOM: nama, kategori, dan nominal dapat diubah atau item dihapus.</p>}
    <fieldset disabled={pending || blocked} className="min-w-0 space-y-3">
      <section className="space-y-3">
        {initial ? <div className={onClose ? "sr-only" : ""}><h2 className="font-semibold">{initial.employeeNameSnapshot}</h2><p className="text-sm text-muted-foreground">{period(initial)} · Identitas, periode, dan snapshot tidak dapat diubah.</p></div> : <>
          <EmployeePicker value={userId} onChange={setUserId} />{error("userId")}
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Tahun</span><Input inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} placeholder="2000–2100" aria-invalid={!!errors.year} />{error("year")}</label>
          <label className="space-y-1 text-sm"><span>Bulan</span><select className={selectClass} value={month} onChange={e => setMonth(e.target.value)} aria-invalid={!!errors.month}><option value="">Pilih bulan</option>{months.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select>{error("month")}</label></div>
        </>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Payment Bank (optional)</span><Input maxLength={100} value={bankName} onChange={e => setBankName(e.target.value)} aria-invalid={!!errors.bankName} />{error("bankName")}</label>
        <label className="space-y-1 text-sm"><span>Account Number (optional)</span><Input maxLength={100} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} aria-invalid={!!errors.accountNumber} />{error("accountNumber")}</label></div>
        {initial?.status === "DRAFT" ? <div className="space-y-1"><Button type="button" variant="outline" className="min-h-11" disabled={pending || blocked || currentState !== initialState.current} onClick={() => { if (!bankName && !accountNumber) { void fillBank(); return; } setConfirmationMutation(true); confirmation.request({ title: "Ganti snapshot bank?", description: "Ganti snapshot bank/rekening dengan data Employee terbaru? Field Employee yang kosong tidak akan menghapus nilai existing.", variant: "warning", confirmLabel: "Ganti snapshot", onConfirm: fillBank }); }}>Fill from Employee</Button><p className="text-xs text-muted-foreground">Simpan perubahan lokal terlebih dahulu. Fill langsung menyimpan snapshot bank dari Employee.</p></div>
          : !initial && <p className="text-xs text-muted-foreground">Field bank yang kosong akan diisi dari Employee saat draft dibuat. Nilai manual yang terisi tetap digunakan.</p>}
        {bankNotice && <p role="status" className="text-sm text-muted-foreground">{bankNotice}</p>}
      </section>
      <div role="region" aria-label="Komponen Payroll, geser horizontal pada layar sempit" tabIndex={0} className="overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-ring">
        <table className="w-full min-w-[680px] table-fixed text-sm">
          <colgroup><col className="w-[38%]" /><col className="w-[32%]" /><col className="w-[22%]" /><col className="w-[8%]" /></colgroup>
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th scope="col" className="p-2">Komponen</th><th scope="col" className="p-2">Nominal (Rp)</th><th scope="col" className="p-2">Kategori</th><th scope="col"><span className="sr-only">Hapus</span></th></tr></thead>
          <tbody className="divide-y">{items.map((item, index) => <tr key={item.uiKey}>
            <td className="p-1.5 align-top"><div className="flex items-center gap-1">{item.origin === "MASTER" && <LockKeyhole aria-label="MASTER" className="size-3.5 shrink-0 text-muted-foreground" />}<Input className="h-11 sm:h-9" aria-label={`Nama komponen ${index + 1} (${item.origin})`} title={`${item.origin} · Urutan ${item.sortOrder}`} readOnly={item.origin === "MASTER"} value={item.name} maxLength={200} onChange={e => changeItem(item.uiKey, { name: e.target.value })} aria-invalid={!!errors[`items.${index}.name`]} /></div>{error(`items.${index}.name`)}{error(`items.${index}.sortOrder`)}{error(`items.${index}.id`)}</td>
            <td className="p-1.5 align-top"><Input className="h-11 text-right tabular-nums sm:h-9" aria-label={`Nominal ${item.name || index + 1}`} inputMode="numeric" maxLength={18} value={item.amount} onChange={e => changeItem(item.uiKey, { amount: e.target.value })} aria-invalid={!!errors[`items.${index}.amount`]} />{error(`items.${index}.amount`)}</td>
            <td className="p-1.5 align-top">{item.origin === "CUSTOM" ? <select aria-label={`Kategori ${item.name || index + 1}`} className={`h-11 w-full rounded-lg border border-input px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring sm:h-9 ${categoryColors[item.category]}`} value={item.category} onChange={e => changeItem(item.uiKey, { category: e.target.value === "DEDUCTION" ? "DEDUCTION" : "EARNING" })}><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option></select> : <span className="flex h-11 items-center sm:h-9"><CategoryBadge category={item.category} /></span>}</td>
            <td className="p-1.5 align-top">{item.origin === "CUSTOM" && <Button type="button" variant="ghost" size="icon" className="size-11 text-destructive sm:size-9" aria-label={`Hapus ${item.name || index + 1}`} onClick={() => { setConfirmationMutation(false); confirmation.request({ title: "Hapus komponen?", description: `Hapus ${item.name || "komponen CUSTOM"} dari draft? Perubahan diterapkan saat Save Draft.`, variant: "danger", confirmLabel: "Hapus komponen", onConfirm: () => { setItems(rows => rows.filter(row => row.uiKey !== item.uiKey || row.origin === "MASTER")); setErrors({}); } }); }}><Trash2 aria-hidden="true" /></Button>}</td>
          </tr>)}</tbody>
        </table>
        {!items.length && <p className="p-3 text-sm text-muted-foreground">Belum ada komponen.</p>}
      </div>
      <div className="flex flex-wrap gap-2">{(["EARNING", "DEDUCTION"] as const).map(category => <Button key={category} type="button" variant="outline" className="min-h-11 sm:min-h-9" disabled={items.length >= 100} onClick={() => {
        const uiKey = `new-${nextLocalKey.current++}`;
        setItems(rows => rows.length >= 100 ? rows : [...rows, { uiKey, origin: "CUSTOM", name: "", category, amount: "0", sortOrder: availableOrder(rows, category) }]);
        setErrors({});
      }}>+ {category === "EARNING" ? "Earning" : "Deduction"}</Button>)}</div>
    </fieldset>
    <p className="text-xs text-muted-foreground">{items.length}/100 komponen. Rupiah bulat tanpa pemisah ribuan. Urutan harus unik per kategori.</p>{error("items")}
    {previewError ? <p role="status" className="text-sm text-destructive">{previewError}</p> : <Totals earnings={earnings.toString()} deductions={deductions.toString()} takeHome={(earnings - deductions).toString()} />}
    <p className="text-xs text-muted-foreground">Preview saja; total tersimpan dihitung dan divalidasi kembali oleh server.</p>
    {message && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{message}</p>}
    <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background py-2"><Button type="submit" className="min-h-11" disabled={pending || blocked}>{pending ? "Menyimpan…" : "Save Draft"}</Button><Button type="button" variant="outline" className="min-h-11" disabled title="PDF tersedia setelah slip dipublikasikan">Download PDF</Button>{initial && <Button type="button" variant="outline" className="min-h-11" disabled={pending || blocked || currentState !== initialState.current} onClick={() => { if (!initial) return; setConfirmationMutation(true); confirmation.request({ title: "Publish Payroll?", description: `Publish slip ${initial.employeeNameSnapshot}, ${period(initial)}? Setelah Publish slip tidak dapat diedit atau dihapus.`, variant: "warning", confirmLabel: "Publish", onConfirm: publish }); }} title={currentState !== initialState.current ? "Simpan perubahan sebelum Publish" : "Finalisasi slip"}>Publish</Button>}{!onClose && <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={leave}>Kembali</Button>}
      {blocked && <Button type="button" variant="outline" className="min-h-11" onClick={() => { const reload = () => { dirty.current = false; window.location.reload(); }; if (dirty.current) discard("Muat ulang data terbaru? Perubahan lokal akan dibuang.", reload); else reload(); }}>Muat ulang data terbaru</Button>}
    </div>
    {confirmation.dialog(message, confirmationMutation && blocked)}
  </form>;
}
