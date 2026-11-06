'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Record that you've paid an importer (e.g. by Venmo). Doesn't move money itself. */
export default function PayRewardsButton({ rewardIds, totalLabel, person }: { rewardIds: string[]; totalLabel: string; person: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardIds, note })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not record the payment.');
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="bg-saddle-green text-white rounded px-3 py-1.5 text-sm font-semibold">
        Mark {totalLabel} as paid
      </button>
    );
  }
  return (
    <form onSubmit={pay} className="flex flex-wrap items-center gap-2">
      <label htmlFor={`pay-note-${rewardIds[0]}`} className="sr-only">How you paid</label>
      <input id={`pay-note-${rewardIds[0]}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
        placeholder="How you paid, e.g. Venmo 11/14" className="border rounded p-1.5 text-sm" />
      <button type="submit" disabled={busy} className="bg-saddle-green text-white rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
        {busy ? 'Saving…' : `Confirm paid ${totalLabel} to ${person}`}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm underline">Cancel</button>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}
