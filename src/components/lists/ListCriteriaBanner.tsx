'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Shown on /saddles?list=<id>: the buyer is choosing filters for an existing list. */
export default function ListCriteriaBanner({ listId, listName, hasFilters }: { listId: string; listName: string; hasFilters: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('list');
    const res = await fetch(`/api/lists/${listId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: params.toString() })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not save. Please try again.');
    router.push(`/lists/${listId}?criteria=updated`);
  }

  return (
    <div className="bg-saddle-cream border border-saddle-tan rounded-lg p-4 mb-4">
      <p className="text-sm">
        Choosing filters for <strong>{listName}</strong>. Set the filters on the left, check the results, then save.
      </p>
      <div className="flex flex-wrap gap-3 mt-2 items-center">
        <button type="button" onClick={save} disabled={saving || !hasFilters}
          className="bg-saddle-green text-white rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : `Save these filters to ${listName}`}
        </button>
        <Link href={`/lists/${listId}`} className="text-sm underline">Cancel</Link>
        {!hasFilters && <span className="text-xs text-gray-600">Pick at least one filter first.</span>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
