'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { closePicker, loadSaved, openPicker, setSaved, useSavedState } from '@/lib/saved-store';

type PickerList = { id: string; name: string; isDefault: boolean; count: number; contains: boolean };

/**
 * The "Save to list" dialog. Mounted once in the layout; any heart opens it via the store.
 * Also reopens itself after sign-in when the page URL carries ?save=<listing id>.
 */
export default function ListPicker() {
  const { pickerFor, loaded, signedIn } = useSavedState();
  const [lists, setLists] = useState<PickerList[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Notes removed in this session, so unticking then re-ticking doesn't lose them.
  const removedNotes = useRef<Record<string, string | null>>({});

  // Back from sign-in with ?save=<id>: open the picker for that saddle, then tidy the URL.
  useEffect(() => {
    loadSaved();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get('save');
    if (!id) return;
    url.searchParams.delete('save');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    if (signedIn) openPicker(id);
  }, [loaded, signedIn]);

  const load = useCallback(async (listingId: string) => {
    setLists(null);
    setError(null);
    try {
      const res = await fetch(`/api/lists?listing=${listingId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLists(data.lists);
    } catch (e: any) {
      setError(e?.message || 'Could not load your lists.');
    }
  }, []);

  useEffect(() => {
    if (!pickerFor) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    removedNotes.current = {};
    setNewName('');
    load(pickerFor);
    requestAnimationFrame(() => dialogRef.current?.focus());
  }, [pickerFor, load]);

  const close = useCallback(() => {
    closePicker();
    openerRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!pickerFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      // Keep Tab inside the dialog.
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>('button, input, a[href]');
        if (!f.length) return;
        const firstEl = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pickerFor, close]);

  function applyLocal(next: PickerList[]) {
    setLists(next);
    if (pickerFor) setSaved(pickerFor, next.some((l) => l.contains));
  }

  async function toggle(list: PickerList) {
    if (!pickerFor || !lists || busy[list.id]) return;
    const listingId = pickerFor;
    const adding = !list.contains;
    const before = lists;
    setError(null);
    setBusy((b) => ({ ...b, [list.id]: true }));
    applyLocal(lists.map((l) => (l.id === list.id ? { ...l, contains: adding, count: l.count + (adding ? 1 : -1) } : l)));
    try {
      const res = adding
        ? await fetch(`/api/lists/${list.id}/items`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId, note: removedNotes.current[list.id] ?? undefined })
          })
        : await fetch(`/api/lists/${list.id}/items?listing=${listingId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      if (!adding) removedNotes.current[list.id] = data.note ?? null;
    } catch (e: any) {
      applyLocal(before); // put the ticks back as they really are
      setError(e?.message || 'That didn’t save. Please try again.');
    } finally {
      setBusy((b) => ({ ...b, [list.id]: false }));
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!pickerFor || !newName.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, listingId: pickerFor })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      applyLocal([...(lists ?? []), data.list]);
      setNewName('');
    } catch (e: any) {
      setError(e?.message || 'Could not create the list.');
    } finally {
      setCreating(false);
    }
  }

  if (!pickerFor) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-picker-title"
        tabIndex={-1}
        className="relative bg-saddle-paper w-full md:max-w-sm rounded-t-xl md:rounded-xl shadow-xl p-5 max-h-[85vh] overflow-y-auto outline-none"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="list-picker-title" className="text-lg font-bold text-saddle-brown">Save to list</h2>
          <button type="button" onClick={close} aria-label="Close" className="text-2xl leading-none px-2 text-gray-500">×</button>
        </div>

        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{error}</p>}

        {!lists && !error && <p className="text-sm text-gray-500 py-4">Loading your lists…</p>}

        {lists && (
          <ul className="space-y-1 mb-4">
            {lists.map((l) => (
              <li key={l.id}>
                <label className="flex items-center gap-3 py-2 px-2 rounded hover:bg-saddle-cream cursor-pointer">
                  <input
                    type="checkbox"
                    checked={l.contains}
                    disabled={!!busy[l.id]}
                    onChange={() => toggle(l)}
                    className="w-5 h-5"
                  />
                  <span className="flex-1">{l.name}</span>
                  <span className="text-xs text-gray-500">{l.count}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={create} className="flex gap-2 mb-4">
          <label htmlFor="new-list-name" className="sr-only">New list name</label>
          <input
            id="new-list-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
            placeholder="New list, e.g. Lionel"
            className="flex-1 border rounded p-2 text-sm"
          />
          <button type="submit" disabled={!newName.trim() || creating}
            className="bg-saddle-green text-white rounded px-3 text-sm font-semibold disabled:opacity-50">
            {creating ? 'Adding…' : 'Create'}
          </button>
        </form>

        <div className="flex items-center justify-between">
          <Link href="/lists" onClick={close} className="text-sm underline text-saddle-brown">Manage lists</Link>
          <button type="button" onClick={close} className="bg-saddle-brown text-white rounded px-4 py-2 text-sm font-semibold">
            Done
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3">Saving a saddle doesn&apos;t hold it. Anyone can still buy it.</p>
      </div>
    </div>
  );
}
