'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function post(orderId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/orders/${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  if (!res?.ok) throw new Error(data?.error ?? 'That didn’t save.');
  return data;
}

export function MarkDeliveredForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap gap-2 items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm('Mark delivered? This starts the buyer’s 5-day inspection and can’t be undone here.')) return;
        setBusy(true);
        setError(null);
        try {
          await post(orderId, { action: 'mark_delivered', deliveredAt: when ? new Date(when).toISOString() : undefined });
          router.refresh();
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs">
        <span className="block font-semibold">Delivered at (from tracking; blank = now)</span>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="border rounded p-1.5 text-sm" />
      </label>
      <button type="submit" disabled={busy} className="bg-saddle-green text-white rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
        {busy ? 'Saving…' : 'Mark delivered'}
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}

export function ResolveReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go(outcome: 'release' | 'keep_hold') {
    setBusy(true);
    setError(null);
    try {
      await post(orderId, { action: 'resolve', outcome, note });
      setNote('');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <label htmlFor={`note-${orderId}`} className="text-xs font-semibold">What was decided</label>
      <textarea id={`note-${orderId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000}
        className="w-full border rounded p-2 text-sm" placeholder="e.g. Buyer withdrew the return; fit was fine after flocking adjustment" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !note.trim()} onClick={() => go('release')}
          className="bg-saddle-green text-white rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          Close review, release payout hold
        </button>
        <button type="button" disabled={busy || !note.trim()} onClick={() => go('keep_hold')}
          className="border border-saddle-tan rounded px-3 py-1.5 text-sm disabled:opacity-50">
          Add note, keep payout paused
        </button>
      </div>
      <p className="text-xs text-gray-600">To refund, issue it in the Stripe dashboard; the order updates itself when Stripe confirms.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
