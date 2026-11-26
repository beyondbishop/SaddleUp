'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Buyer: "I received it" for a shipped order. Starts the 5-day trial. */
export default function ReceivedButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!window.confirm('Confirm the saddle has arrived? Your 5-day trial starts now.')) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/received`, { method: 'POST' }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not save. Please try again.');
    router.refresh();
  }

  return (
    <div>
      <button onClick={confirm} disabled={busy} className="bg-saddle-green text-white rounded px-4 py-2 font-semibold disabled:opacity-50">
        {busy ? 'Saving…' : 'I received it'}
      </button>
      {error && <p role="alert" className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
