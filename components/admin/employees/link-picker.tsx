"use client";
import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { request } from "./client-api";
type Option = { id: string; label: string };
export function EmployeeLinkPicker({ kind, value, onChange, disabled = false }: {
  kind: "employee" | "user"; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState(""), [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Option | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let live = true; setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      request<Option[]>(`/link-options?${new URLSearchParams({ kind, search })}`)
        .then(rows => { if (live) setOptions(rows); })
        .catch(() => { if (live) { setOptions([]); setError("Options could not be loaded. Change the search to retry."); } })
        .finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [kind, search]);
  return <div className="space-y-2 text-sm">
    <label htmlFor={`${id}-search`} className="font-medium">{kind === "employee" ? "Search unlinked Employees" : "Link Existing User (optional)"}</label>
    <Input id={`${id}-search`} disabled={disabled} value={search} maxLength={100} placeholder={kind === "employee" ? "Name or employee number" : "Name or email"} onChange={e => setSearch(e.target.value)} />
    <label htmlFor={`${id}-select`} className="sr-only">Select {kind}</label>
    <select id={`${id}-select`} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3" disabled={disabled || loading} value={value} onChange={e => { setSelected(options.find(option => option.id === e.target.value) ?? null); onChange(e.target.value); }}>
      <option value="">{kind === "employee" ? "Select an Employee" : "No login account"}</option>
      {value && selected && !options.some(option => option.id === value) && <option value={selected.id}>{selected.label}</option>}
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <p role="status" className="text-xs text-muted-foreground">{error || (loading ? "Loading options…" : `${options.length} matches shown (maximum 30). Refine search if needed.`)}</p>
  </div>;
}
