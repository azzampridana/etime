"use client";

import { useState } from "react";
import { listUsersAction } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Choice = { id: string; name: string; email: string };
export function UserFilter({ selected }: { selected?: Choice }) {
  const [choice, setChoice] = useState(selected);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Choice[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function find() {
    setPending(true); setMessage("");
    try {
      const result = await listUsersAction({ search, page: 1, pageSize: 20 });
      setItems(result.data?.items.map(({ id, name, email }) => ({ id, name, email })) ?? []);
      setMessage(result.success ? result.data?.total ? "Select a user below. Showing up to 20 matches; refine your search if needed." : "No users found." : result.message);
    } catch { setMessage("Unable to search users. Please try again."); }
    finally { setPending(false); }
  }
  return <div className="min-w-0 space-y-2 sm:col-span-2">
    <Label htmlFor="user-search">User</Label>
    <input type="hidden" name="userId" value={choice?.id ?? ""} />
    <p className="break-words text-sm">{choice ? `${choice.name} · ${choice.email}` : "All users, including inactive accounts"}</p>
    <div className="flex flex-wrap gap-2"><Input id="user-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find by name or email" className="min-h-12 min-w-0 flex-1" />
      <Button type="button" variant="outline" className="min-h-12" disabled={pending} onClick={find}>{pending ? "Searching…" : "Find users"}</Button>
      {choice && <Button type="button" variant="outline" className="min-h-12" onClick={() => setChoice(undefined)}>All users</Button>}</div>
    <p role="status" className="text-sm">{message}</p>
    {!!items.length && <ul className="max-h-64 overflow-y-auto rounded-lg border">{items.map((item) => <li key={item.id}>
      <button type="button" className="min-h-12 w-full break-words p-3 text-left text-sm hover:bg-muted focus-visible:bg-muted" onClick={() => { setChoice(item); setItems([]); setMessage("User selected. Apply filters to view attendance."); }}>{item.name} · {item.email}</button>
    </li>)}</ul>}
  </div>;
}
