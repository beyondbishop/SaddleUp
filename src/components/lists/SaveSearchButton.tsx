'use client';
import { useState } from 'react';
import Link from 'next/link';
import { goToSignIn } from '@/lib/return-to';

/** Save the current browse filters as a new named list (works with zero results). */
export default function SaveSearchButton({ suggestedName, signedIn }: { suggestedName: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName.slice(0, 60));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);

  if (saved) {
    return (
      <p role="status" className="text-sm bg-saddle-cream border border-saddle-tan rounded p-3">
        Saved as <Link href={`/lists/${saved.id}`} className="underline font-semibold">{saved.name}</Link>.
        Matching saddles will show up there as suggestions.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => (signedIn ? setOpen(true) : goToSignIn())}
        className="text-sm border border-saddle-tan rounded px-3 py-1.5 font-semibold text-saddle-brown hover:bg-saddle-cream"
      >
        Save this search as a list
      </button>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, search: window.location.search })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not save. Please try again.');
    setSaved({ id: data.list.id, name: data.list.name });
  }

  return (
    <form onSubmit={save} className="flex flex-wrap gap-2 items-center bg-saddle-cream border border-saddle-tan rounded p-3">
      <label htmlFor="save-search-name" className="text-sm font-semibold">List name</label>
      <input id="save-search-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus
        className="flex-1 min-w-[12rem] border rounded p-2 text-sm" placeholder="e.g. Lionel" />
      <button type="submit" disabled={saving || !name.trim()} className="bg-saddle-green text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm underline">Cancel</button>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}
