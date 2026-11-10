"use client";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContactInput } from "@/schemas/employee-contact.schema";
import { EmployeeHttpError, request } from "./client-api";
type Contact = ContactInput & { id: string; version: number };
type Result = { items: Contact[]; total: number; pageSize: number; employeeVersion: number };
export type ContactGuard = { isBusy: () => boolean; hasUnsavedChanges: () => boolean; needsProtection: () => boolean };
const empty: ContactInput = { name: "", relationship: "", phoneNumber: "", address: null, isEmergencyContact: false, isPrimary: false };
export function FamilyContacts({ employeeId, employeeVersion, profileDirty, onCommitted, onConflict, guard }: {
  employeeId: string; employeeVersion: number; profileDirty: boolean; onCommitted: (version: number) => void; onConflict: () => void; guard: Ref<ContactGuard>;
}) {
  const [data, setData] = useState<Result | null>(null), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Contact | "new" | null>(null), [form, setForm] = useState<ContactInput>(empty);
  const [error, setError] = useState(""), [pending, setPending] = useState(false), [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState("");
  const busy = useRef(false), baseline = useRef(JSON.stringify(empty));
  const dirty = editing !== null && JSON.stringify(form) !== baseline.current;
  const confirmation = useConfirmDialog();
  const [deleting, setDeleting] = useState(false);
  function withDiscard(action: () => void) {
    if (busy.current || confirmation.isOpen()) return;
    if (!dirty) { action(); return; }
    setDeleting(false);
    confirmation.request({ title: "Batalkan perubahan kontak?", description: "Discard unsaved contact changes?", variant: "warning",
      confirmLabel: "Discard Changes", cancelLabel: "Continue Editing", onConfirm: action });
  }
  useImperativeHandle(guard, () => ({ isBusy: () => busy.current || confirmation.isOpen(), hasUnsavedChanges: () => dirty, needsProtection: () => dirty || busy.current }));
  useEffect(() => {
    let live = true; setData(null);
    request<Result>(`/${employeeId}/contacts?page=${page}`).then(result => { if (live) { setData(result); setBlocked(false); } })
      .catch(() => { if (live) setError("Contacts could not be loaded. Reload before continuing."); });
    return () => { live = false; };
  }, [employeeId, page, revision]);
  function reload() { withDiscard(() => { setEditing(null); setError(""); setRevision(n => n + 1); }); }
  function edit(contact: Contact | "new") {
    withDiscard(() => {
    const next = contact === "new" ? empty : { name: contact.name, relationship: contact.relationship, phoneNumber: contact.phoneNumber,
      address: contact.address, isEmergencyContact: contact.isEmergencyContact, isPrimary: contact.isPrimary };
    setForm(next); baseline.current = JSON.stringify(next); setEditing(contact); setError("");
    });
  }
  async function mutate(remove?: Contact) {
    if (!data || profileDirty || blocked || busy.current || (!remove && !editing)) return false;
    if (data.employeeVersion !== employeeVersion) {
      setError("Profile changed in another session. Reload Employee from a profile tab before editing contacts.");
      setBlocked(true); onConflict(); return false;
    }
    busy.current = true; setPending(true); setError(""); setNotice("");
    const target = remove ?? (editing === "new" ? null : editing);
    let result: { employeeVersion: number };
    try {
      result = await request<{ employeeVersion: number }>(`/${employeeId}/contacts${target ? `/${target.id}` : ""}`, remove ? "DELETE" : target ? "PUT" : "POST",
        { ...(remove ? {} : form), employeeVersion: data.employeeVersion, ...(target ? { version: target.version } : {}) });
    } catch (failure) {
      const status = failure instanceof EmployeeHttpError ? failure.status : undefined;
      if (status === 404) {
        setError("Employee or contact resource not found. Reload Employee and contacts before retrying.");
      } else if (status === 401 || status === 403) {
        setError(status === 401 ? "Please sign in again before modifying contacts." : "You do not have permission to modify these contacts.");
      } else if (failure instanceof EmployeeHttpError && (status === 400 || status === 422 || status === 409)) {
        setError(failure.message);
      } else {
        setError("Outcome unknown. Reload and inspect contacts before retrying.");
      }
      setBlocked(status !== 400 && status !== 422);
      if (failure instanceof EmployeeHttpError && failure.status === 409) onConflict();
      busy.current = false; setPending(false); return false;
    }
    busy.current = false; setPending(false); setEditing(null); setNotice("Contact change saved.");
    onCommitted(result.employeeVersion); setRevision(n => n + 1);
  }
  return <div className="space-y-3">
    {profileDirty && <p role="status" className="text-sm">Save Employee changes before modifying contacts.</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <div role="alert"><p className="text-sm text-destructive">{error}</p><Button type="button" variant="outline" onClick={reload} disabled={pending}>Reload contacts</Button></div>}
    {!data ? <p role="status">{error ? "Contacts unavailable." : "Loading contacts…"}</p> : <>
      <Button type="button" disabled={profileDirty || pending || blocked} onClick={() => edit("new")}>Add Contact</Button>
      {!data.items.length && <p className="text-sm text-muted-foreground">No family or emergency contacts.</p>}
      <div className="space-y-2">{data.items.map(contact => <div key={contact.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0 break-words"><p className="font-medium">{contact.name}</p><p className="text-sm text-muted-foreground">{contact.relationship} · {contact.phoneNumber}</p><div className="flex gap-2 text-xs">{contact.isPrimary && <span className="rounded bg-accent px-2 py-1">Primary</span>}{contact.isEmergencyContact && <span className="rounded bg-muted px-2 py-1">Emergency</span>}</div></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-10" disabled={profileDirty || pending || blocked} onClick={() => edit(contact)}>Edit Contact</Button><Button type="button" variant="destructive" className="min-h-10" disabled={profileDirty || pending || blocked || editing !== null} onClick={() => { if (busy.current || confirmation.isOpen()) return; setDeleting(true); confirmation.request({ title: "Hapus kontak?", description: "Delete this contact? No replacement primary will be selected automatically.", variant: "danger", confirmLabel: "Delete Contact", onConfirm: () => mutate(contact) }); }}>Delete</Button></div>
      </div>)}</div>
      <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={pending || page === 1} onClick={() => withDiscard(() => { setEditing(null); setPage(n => n - 1); })}>Previous</Button><span className="text-sm">Page {page}</span><Button type="button" variant="outline" disabled={pending || page * data.pageSize >= data.total} onClick={() => withDiscard(() => { setEditing(null); setPage(n => n + 1); })}>Next</Button></div>
      {editing && <form autoComplete="off" className="space-y-3 rounded-lg border p-3" onSubmit={e => { e.preventDefault(); void mutate(); }}><fieldset disabled={pending || blocked || profileDirty} className="space-y-3"><legend className="font-semibold">{editing === "new" ? "New Contact" : "Edit Contact"}</legend>
        {([['name', 'Full Name', 100], ['relationship', 'Relationship', 50], ['phoneNumber', 'Phone Number', 50]] as const).map(([key, label, max]) => <label key={key} className="block space-y-1 text-sm"><span>{label}</span><Input required maxLength={max} type="text" value={form[key]} onChange={e => setForm(value => ({ ...value, [key]: e.target.value }))} /></label>)}

        <label className="block space-y-1 text-sm"><span>Address (optional)</span><Textarea maxLength={5000} value={form.address ?? ""} onChange={e => setForm(value => ({ ...value, address: e.target.value || null }))} /></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.isEmergencyContact} onChange={e => setForm(value => ({ ...value, isEmergencyContact: e.target.checked, isPrimary: e.target.checked && value.isPrimary }))} />Emergency Contact</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.isPrimary} onChange={e => setForm(value => ({ ...value, isPrimary: e.target.checked, isEmergencyContact: e.target.checked || value.isEmergencyContact }))} />Primary Contact</label>
        <p className="text-xs text-muted-foreground">Selecting Primary replaces the current primary. Primary must be an Emergency Contact.</p>
      </fieldset><div className="flex gap-2"><Button type="submit" disabled={pending || blocked || profileDirty}>{pending ? "Saving…" : "Save Contact"}</Button><Button type="button" variant="outline" disabled={pending} onClick={() => withDiscard(() => setEditing(null))}>Cancel</Button></div></form>}
    </>}
    {confirmation.dialog(error, deleting && (blocked || profileDirty))}
  </div>;
}
