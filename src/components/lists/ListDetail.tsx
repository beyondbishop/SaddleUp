'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TREE_WIDTH_LABELS, type TreeWidth } from '@/lib/types';
import { CONDITION_LABELS, type Condition } from '@/lib/search';
import { loadSaved } from '@/lib/saved-store';

export type ListItemView = {
  listingId: string;
  note: string | null;
  savedAt: string;
  availability: 'available' | 'in_checkout' | 'sold' | 'unavailable';
  listing: {
    slug: string; model: string; seat_size: number; tree_width: TreeWidth; price_cents: number;
    images: string[] | null; condition: string | null; location_state: string | null;
    brands: { name: string } | null;
  } | null;
  similarUrl: string;
};

type ListInfo = { id: string; name: string; description: string | null; isDefault: boolean; archived: boolean };

async function call(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  if (!res?.ok) throw new Error(data?.error ?? 'That didn’t save. Please try again.');
  return data;
}

export default function ListDetail({ list: initial, initialItems }: { list: ListInfo; initialItems: ListItemView[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? '');
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ item: ListItemView; index: number; note: string | null } | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  async function saveHeader(e: React.FormEvent) {
    e.preventDefault();
    setHeaderError(null);
    try {
      const { list: saved } = await call(`/api/lists/${list.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description })
      });
      setList({ ...list, name: saved.name, description: saved.description });
      setEditing(false);
    } catch (err: any) {
      setHeaderError(err.message);
    }
  }

  async function setArchived(archived: boolean) {
    setHeaderError(null);
    try {
      await call(`/api/lists/${list.id}`, { method: 'PATCH', body: JSON.stringify({ archived }) });
      setList({ ...list, archived });
      loadSaved(true);
      if (archived) router.push('/lists');
    } catch (err: any) {
      setHeaderError(err.message);
    }
  }

  async function remove(item: ListItemView) {
    const index = items.findIndex((i) => i.listingId === item.listingId);
    setToastError(null);
    setItems((all) => all.filter((i) => i.listingId !== item.listingId));
    try {
      const data = await call(`/api/lists/${list.id}/items?listing=${item.listingId}`, { method: 'DELETE' });
      clearTimeout(undoTimer.current);
      setUndo({ item, index, note: data.note ?? item.note });
      undoTimer.current = setTimeout(() => setUndo(null), 8000);
      loadSaved(true);
    } catch (err: any) {
      setItems((all) => [...all.slice(0, index), item, ...all.slice(index)]);
      setToastError(err.message);
    }
  }

  async function undoRemove() {
    if (!undo) return;
    const { item, index, note } = undo;
    setUndo(null);
    clearTimeout(undoTimer.current);
    try {
      await call(`/api/lists/${list.id}/items`, { method: 'PUT', body: JSON.stringify({ listingId: item.listingId, note }) });
      setItems((all) => [...all.slice(0, index), { ...item, note }, ...all.slice(index)]);
      loadSaved(true);
    } catch (err: any) {
      setToastError(err.message);
    }
  }

  return (
    <div>
      <div className="mt-3 mb-6">
        {editing ? (
          <form onSubmit={saveHeader} className="space-y-2 max-w-xl">
            <label htmlFor="list-edit-name" className="sr-only">List name</label>
            <input id="list-edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
              className="w-full border rounded p-2 text-lg font-semibold" />
            <label htmlFor="list-edit-desc" className="sr-only">Description</label>
            <textarea id="list-edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500}
              rows={2} placeholder="Optional: what this list is for (horse, client, budget…)" className="w-full border rounded p-2 text-sm" />
            <div className="flex gap-2">
              <button type="submit" className="bg-saddle-green text-white rounded px-4 py-1.5 text-sm font-semibold">Save</button>
              <button type="button" onClick={() => { setEditing(false); setName(list.name); setDescription(list.description ?? ''); }}
                className="text-sm underline">Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-saddle-brown">{list.name}</h1>
            {list.description && <p className="text-gray-600 mt-1">{list.description}</p>}
            <div className="flex flex-wrap gap-4 mt-2 text-sm">
              <button type="button" onClick={() => setEditing(true)} className="underline">Rename or describe</button>
              {!list.isDefault && (
                list.archived
                  ? <button type="button" onClick={() => setArchived(false)} className="underline">Restore list</button>
                  : <button type="button" onClick={() => setArchived(true)} className="underline text-gray-600">Archive list</button>
              )}
            </div>
            {list.archived && <p className="text-sm text-gray-500 mt-2">This list is archived. Its saddles don&apos;t show as saved.</p>}
          </>
        )}
        {headerError && <p role="alert" className="text-sm text-red-700 mt-2">{headerError}</p>}
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500">
          Nothing here yet. <Link href="/saddles" className="underline">Browse saddles</Link> and tap the heart to save one to this list.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ListItemCard key={item.listingId} listId={list.id} item={item} onRemove={() => remove(item)} />
          ))}
        </ul>
      )}

      <div aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md">
        {undo && (
          <div className="bg-saddle-ink text-white rounded-lg shadow-lg px-4 py-3 flex items-center justify-between text-sm">
            <span>Removed from {list.name}.</span>
            <button type="button" onClick={undoRemove} className="font-semibold underline ml-4">Undo</button>
          </div>
        )}
        {toastError && (
          <div role="alert" className="bg-red-700 text-white rounded-lg shadow-lg px-4 py-3 text-sm flex justify-between">
            <span>{toastError}</span>
            <button type="button" onClick={() => setToastError(null)} aria-label="Dismiss" className="ml-4">×</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ListItemCard({ listId, item, onRemove }: { listId: string; item: ListItemView; onRemove: () => void }) {
  const l = item.listing;
  return (
    <li className="bg-white border border-saddle-tan rounded-lg overflow-hidden flex flex-col">
      {l ? (
        <Link href={`/saddles/${l.slug}`} className="block">
          <div className="aspect-[4/3] bg-saddle-cream relative">
            {l.images?.[0] ? (
              <Image src={l.images[0]} alt={`${l.seat_size}" ${l.brands?.name ?? ''} ${l.model}`} fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-saddle-brown/40">No photo yet</div>
            )}
            {item.availability === 'in_checkout' && (
              <span className="absolute top-2 left-2 bg-saddle-brown text-white text-xs rounded px-2 py-1">In checkout</span>
            )}
          </div>
          <div className="p-3">
            <p className="font-semibold text-saddle-brown">{l.seat_size}&quot; {l.brands?.name} {l.model}</p>
            <p className="text-sm text-gray-600">
              {TREE_WIDTH_LABELS[l.tree_width]} Tree{l.location_state ? ` · ${l.location_state}` : ''}
            </p>
            <p className="text-xs text-gray-500">
              {l.condition ? `${CONDITION_LABELS[l.condition as Condition] ?? l.condition} condition` : 'Condition not stated'}
            </p>
            <p className="font-bold mt-1">${(l.price_cents / 100).toLocaleString('en-US')}</p>
          </div>
        </Link>
      ) : (
        <div className="p-4 bg-saddle-cream/60">
          <p className="font-semibold text-gray-700">
            {item.availability === 'sold' ? 'Sold' : 'No longer available'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {item.availability === 'sold'
              ? 'Someone else bought this saddle.'
              : 'The seller has taken this saddle off SaddleUp.'}
          </p>
          <Link href={item.similarUrl} className="text-sm underline text-saddle-green mt-2 inline-block">See similar saddles</Link>
        </div>
      )}

      <div className="p-3 border-t border-saddle-line mt-auto">
        <NoteEditor listId={listId} listingId={item.listingId} initial={item.note} />
        <div className="flex justify-between items-center mt-2 text-sm">
          {l && <Link href={item.similarUrl} className="underline text-gray-600">Similar</Link>}
          <button type="button" onClick={onRemove} className="underline text-gray-600 ml-auto">Remove</button>
        </div>
      </div>
    </li>
  );
}

function NoteEditor({ listId, listingId, initial }: { listId: string; listingId: string; initial: string | null }) {
  const [saved, setSaved] = useState(initial ?? '');
  const [text, setText] = useState(initial ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const dirty = text !== saved;

  async function save() {
    if (!dirty || status === 'saving') return;
    setStatus('saving');
    setError(null);
    try {
      const data = await call(`/api/lists/${listId}/items`, { method: 'PATCH', body: JSON.stringify({ listingId, note: text }) });
      setSaved(data.note ?? '');
      setText(data.note ?? '');
      setStatus('saved');
    } catch (err: any) {
      // Keep what they typed so nothing is lost; they can retry.
      setStatus('error');
      setError(err.message);
    }
  }

  const id = `note-${listId}-${listingId}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-gray-600">Private note</label>
      <textarea id={id} value={text} onChange={(e) => { setText(e.target.value); setStatus('idle'); }} onBlur={save}
        maxLength={2000} rows={2} placeholder="Only you can see this" className="w-full border rounded p-2 text-sm mt-1" />
      <div className="flex items-center gap-2 text-xs min-h-5" aria-live="polite">
        {dirty && status !== 'saving' && (
          <button type="button" onClick={save} className="underline font-semibold">Save note</button>
        )}
        {status === 'saving' && <span className="text-gray-500">Saving…</span>}
        {status === 'saved' && !dirty && <span className="text-gray-500">Saved</span>}
        {status === 'error' && <span role="alert" className="text-red-700">{error}</span>}
      </div>
    </div>
  );
}
