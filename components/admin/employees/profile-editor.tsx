"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dialog, Tabs } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createEmployeeSchema, employmentStatuses, maritalStatuses, employmentTypes, type EmployeeInput } from "@/schemas/employee.schema";
import type { toEmployeeDetail } from "@/mappers/employee.mapper";
import { EmployeeHttpError, request } from "./client-api";
import { FamilyContacts, type ContactGuard } from "./family-contacts";
import { EmployeeLinkPicker } from "./link-picker";
type Detail = ReturnType<typeof toEmployeeDetail>;
const blank: EmployeeInput = { fullName: "", nik: null, phoneNumber: null, address: null, employeeNumber: null,
  jobTitle: null, joinDate: null, employmentStatus: "ACTIVE", employmentEndDate: null, bankName: null, bankAccountNumber: null,
  bankAccountHolder: null, npwp: null, placeOfBirth: null, dateOfBirth: null, gender: null, maritalStatus: null,
  employmentType: null, bpjsKesehatanNumber: null, bpjsKetenagakerjaanNumber: null };
type Field = { key: keyof EmployeeInput; label: string; max?: number; date?: boolean; choices?: readonly string[] };
// Presentation labels only: retain persisted enum values, including legacy OTHER.
const identityLabels: Partial<Record<keyof EmployeeInput, Readonly<Record<string, string>>>> = {
  gender: { MALE: "LAKI-LAKI", FEMALE: "PEREMPUAN" },
  maritalStatus: { SINGLE: "BELUM KAWIN", MARRIED: "KAWIN", DIVORCED: "CERAI HIDUP", WIDOWED: "CERAI MATI" },
};
const groups: { title: string; fields: Field[] }[] = [
  { title: "Personal Information", fields: [{ key: "fullName", label: "Full Name", max: 100 }, { key: "nik", label: "NIK", max: 32 }, { key: "npwp", label: "NPWP", max: 32 }, { key: "placeOfBirth", label: "Place of Birth", max: 100 }, { key: "dateOfBirth", label: "Date of Birth", date: true }, { key: "gender", label: "Gender", choices: ["MALE", "FEMALE"] }, { key: "maritalStatus", label: "Marital Status", choices: maritalStatuses }] },
  { title: "Employment Information", fields: [{ key: "employeeNumber", label: "Employee Number", max: 50 }, { key: "jobTitle", label: "Job Title", max: 100 }, { key: "joinDate", label: "Join Date", date: true }, { key: "employmentStatus", label: "Employment Status", choices: employmentStatuses }, { key: "employmentType", label: "Employment Type", choices: employmentTypes }, { key: "employmentEndDate", label: "Employment End Date", date: true }] },
  { title: "Contact Information", fields: [{ key: "phoneNumber", label: "Phone Number", max: 50 }, { key: "address", label: "Address", max: 5000 }] },
  { title: "Bank & Social Security", fields: [{ key: "bankName", label: "Bank Name", max: 100 }, { key: "bankAccountNumber", label: "Account Number", max: 100 }, { key: "bankAccountHolder", label: "Account Holder", max: 100 }, { key: "bpjsKesehatanNumber", label: "BPJS Kesehatan Number", max: 50 }, { key: "bpjsKetenagakerjaanNumber", label: "BPJS Ketenagakerjaan Number", max: 50 }] },
];
export function EmployeeEditor({ id, close, saved }: { id: string | null; close: () => void; saved: (confirmed?: boolean) => void }) {
  const [activeId, setActiveId] = useState(id), [row, setRow] = useState<Detail | null>(null), [form, setForm] = useState<EmployeeInput>(blank);
  const [tab, setTab] = useState(groups[0].title), [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [pending, setPending] = useState(false), [blocked, setBlocked] = useState(false);
  const [revision, setRevision] = useState(0);
  const [linkedUserId, setLinkedUserId] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const confirmation = useConfirmDialog();
  const initial = useRef(JSON.stringify(blank)), busy = useRef(false), changed = useRef(false), contact = useRef<ContactGuard | null>(null);
  const dirty = JSON.stringify(form) !== initial.current || (!activeId && Boolean(linkedUserId));
  function apply(value: Detail) {
    const fields = { ...blank };
    for (const key of Object.keys(blank) as (keyof EmployeeInput)[]) Object.assign(fields, { [key]: value[key] });
    setRow(value); setForm(fields); initial.current = JSON.stringify(fields); setBlocked(false);
  }
  useEffect(() => {
    if (!activeId) return;
    let live = true; setLoading(true); setError("");
    request<Detail>(`/${activeId}`).then(value => { if (live) apply(value); }).catch(() => { if (live) setError("Profile could not be loaded. Reload before continuing."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [activeId, revision]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (dirty || busy.current || contact.current?.needsProtection()) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", unload); return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  function withDiscard(action: () => void, includeProfile = true) {
    if (busy.current || confirmation.isOpen() || contact.current?.isBusy()) return;
    const contactDirty = contact.current?.hasUnsavedChanges();
    if (!(includeProfile && dirty) && !contactDirty) { action(); return; }
    confirmation.request({ title: "Batalkan Perubahan?", description: includeProfile && dirty
      ? contactDirty ? "Discard unsaved profile and contact changes?" : "Discard unsaved profile changes?"
      : "Discard unsaved contact changes?", variant: "warning", confirmLabel: "Discard Changes", cancelLabel: "Continue Editing", onConfirm: action });
  }
  function leave() { withDiscard(() => { if (changed.current) saved(); else close(); }); }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy.current || blocked || (activeId && !row)) return;
    const parsed = createEmployeeSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(" ")); return; }
    busy.current = true; setPending(true); setError(""); setNotice("");
    let result: Detail;
    try { result = await request<Detail>(activeId ? `/${activeId}` : "", activeId ? "PUT" : "POST", { ...parsed.data, ...(row ? { version: row.version } : {}), ...(!activeId && linkedUserId ? { userId: linkedUserId } : {}) }); }
    catch (failure) { setError(failure instanceof EmployeeHttpError ? failure.message : "Outcome unknown. Reload and inspect Employees before retrying."); setBlocked(!(failure instanceof EmployeeHttpError) || failure.status !== 400); busy.current = false; setPending(false); return; }
    busy.current = false; setPending(false); changed.current = true; apply(result); setActiveId(result.id); setNotice("Employee saved. Family contacts can now be managed.");
  }
  return <Dialog.Root open><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" /><Dialog.Content
    onEscapeKeyDown={e => { e.preventDefault(); leave(); }} onPointerDownOutside={e => { e.preventDefault(); leave(); }} onInteractOutside={e => e.preventDefault()}
    className="fixed inset-0 z-50 flex h-dvh min-w-0 flex-col overflow-hidden bg-background sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[88dvh] sm:w-[calc(100%_-_2rem)] sm:max-w-[900px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border">
    <div className="flex shrink-0 items-center justify-between border-b px-4 py-2"><Dialog.Title className="font-semibold">{activeId ? "Employee Profile" : "Create Employee"}</Dialog.Title><Button type="button" variant="ghost" size="icon" aria-label="Tutup" disabled={pending} onClick={leave}><X aria-hidden="true" /></Button></div>
    <Dialog.Description className="shrink-0 px-4 py-3 text-sm text-muted-foreground">Personnel information and family contacts. Login access and Payroll remain separate.</Dialog.Description>
    <Tabs.Root className="flex min-h-0 flex-1 flex-col" value={tab} onValueChange={value => { if (value !== tab) withDiscard(() => { setTab(value); if (contentRef.current) contentRef.current.scrollTop = 0; }, false); }}>
      <Tabs.List aria-label="Employee profile sections" className="flex shrink-0 gap-1 overflow-x-auto border-b px-4 pb-2">{[...groups.map(group => group.title), "Family & Emergency"].map(title => <Tabs.Trigger key={title} value={title} className="min-h-11 shrink-0 whitespace-nowrap rounded-md px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">{title}</Tabs.Trigger>)}</Tabs.List>
    <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto p-4">
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="mb-3 text-sm">{notice}</p>}
      {loading ? <p role="status">Loading profile…</p> : activeId && !row ? <Button onClick={() => setRevision(n => n + 1)}>Reload</Button> : <>
        <form id="employee-profile-form" onSubmit={submit} autoComplete="off" noValidate>
          {!activeId && <div className="mb-4 border-b pb-4"><EmployeeLinkPicker kind="user" value={linkedUserId} onChange={setLinkedUserId} disabled={pending || blocked} /></div>}
          {groups.map(group => <Tabs.Content key={group.title} value={group.title}><fieldset disabled={pending || blocked} className="space-y-3">
            <legend className="sr-only">{group.title}</legend><div className="grid gap-3 sm:grid-cols-2">{group.fields.map(field => <label key={field.key} className={`block space-y-1 text-sm ${field.key === "address" ? "sm:col-span-2" : ""}`}><span>{field.label}{field.key === "fullName" ? " *" : ""}</span>
              {field.choices ? <select className="min-h-11 w-full rounded-md border bg-background px-3" value={form[field.key] ?? ""} onChange={e => setForm(value => ({ ...value, [field.key]: e.target.value || null }))}>{field.key !== "employmentStatus" && <option value="">Not specified</option>}{field.key === "gender" && form.gender === "OTHER" && <option value="OTHER" disabled>OTHER (nilai lama — tetap disimpan)</option>}{field.choices.map(value => <option key={value} value={value}>{identityLabels[field.key]?.[value] ?? value.replaceAll("_", " ")}</option>)}</select>
                : field.key === "address" ? <Textarea maxLength={field.max} value={form.address ?? ""} onChange={e => setForm(value => ({ ...value, address: e.target.value || null }))} />
                : <Input type={field.date ? "date" : "text"} autoComplete="off" maxLength={field.max} value={form[field.key] ?? ""} onChange={e => setForm(value => ({ ...value, [field.key]: e.target.value || (field.key === "fullName" ? "" : null) }))} />}
            </label>)}</div>
            {group.title === "Contact Information" && <p className="break-words text-sm">Login Email: {row?.user?.email || "No login account linked"}</p>}

          </fieldset></Tabs.Content>)}
        </form>
        <Tabs.Content value="Family & Emergency">{activeId && row ? <FamilyContacts employeeId={activeId} employeeVersion={row.version} profileDirty={dirty || blocked} guard={contact} onConflict={() => setBlocked(true)} onCommitted={version => { changed.current = true; setRow(value => value ? { ...value, version } : value); }} /> : <p className="text-sm">Save Employee first before adding family contacts.</p>}</Tabs.Content>
      </>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-background px-4 py-3">
      <Button type="button" variant="outline" disabled={pending} onClick={leave}>{activeId ? "Close" : "Cancel"}</Button>
      {tab !== "Family & Emergency" && !loading && (!activeId || row) && (blocked ? <Button type="button" onClick={() => withDiscard(() => { if (activeId) { setTab(groups[0].title); setRevision(n => n + 1); } else saved(false); })}>Reload authoritative data</Button> : <Button type="submit" form="employee-profile-form" disabled={pending}>{pending ? "Saving…" : activeId ? "Save Changes" : "Create Employee"}</Button>)}
    </div>
    </Tabs.Root>
    {confirmation.dialog()}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
