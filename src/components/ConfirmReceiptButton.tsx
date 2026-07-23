'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfirmReceiptButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!confirm('Confirm the saddle arrived as described? This releases payment to the seller.')) return;
    setLoading(true);
    setError(null);
    const res = await fetch('/api/orders/confirm-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    router.refresh();
  }

  return (
    <div>
      <button onClick={handleConfirm} disabled={loading} className="bg-saddle-green text-white px-4 py-2 rounded-md font-semibold text-sm">
        {loading ? 'Confirming…' : 'Confirm Receipt & Release Payment'}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
