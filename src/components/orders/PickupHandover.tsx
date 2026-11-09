'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** "I've handed it over" / "I've picked it up" for a local-pickup order. Starts the 5-day trial. */
export default function PickupHandover({ orderId, role }: { orderId: string; role: 'buyer' | 'seller' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const ok = window.confirm(
      role === 'seller'
        ? 'Confirm the buyer has the saddle? Their 5-day trial starts now.'
        : 'Confirm you have the saddle? Your 5-day trial starts now.'
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/pickup`, { method: 'POST' }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not save. Please try again.');
    router.refresh();
  }

  return (
    <div>
      <button onClick={confirm} disabled={busy} className="bg-saddle-green text-white rounded px-4 py-2 font-semibold disabled:opacity-50">
        {busy ? 'Saving…' : role === 'seller' ? 'I’ve handed it over' : 'I’ve picked it up'}
      </button>
      {error && <p role="alert" className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
