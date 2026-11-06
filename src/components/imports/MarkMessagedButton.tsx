'use client';
import { useState } from 'react';

export default function MarkMessagedButton({ listingId, messagedAt }: { listingId: string; messagedAt: string | null }) {
  const [at, setAt] = useState(messagedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(messaged: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/imports/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaged })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not save.');
    setAt(data.messaged_at);
  }

  return (
    <span className="inline-flex flex-col">
      {at ? (
        <span className="text-sm text-saddle-green">
          Messaged {new Date(at).toLocaleDateString('en-US')}{' '}
          <button type="button" onClick={() => set(false)} disabled={busy} className="underline text-gray-500 text-xs">undo</button>
        </span>
      ) : (
        <button type="button" onClick={() => set(true)} disabled={busy}
          className="text-sm bg-saddle-green text-white rounded px-3 py-1.5 font-semibold disabled:opacity-50">
          I&apos;ve messaged them
        </button>
      )}
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
