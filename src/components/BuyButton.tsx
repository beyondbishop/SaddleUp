'use client';

import { useEffect, useState } from 'react';

export default function BuyButton({
  listingId,
  priceCents,
  status
}: {
  listingId: string;
  priceCents: number;
  status: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Returning from Stripe without paying: free the saddle right away.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('canceled') !== '1') return;
    fetch('/api/checkout/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId })
    }).finally(() => {
      params.delete('canceled');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    });
  }, [listingId]);

  if (status !== 'active' && status !== 'pending_sale') {
    return <p className="font-semibold text-gray-600">This saddle is no longer available.</p>;
  }

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      window.location.href = data.url; // redirect to Stripe Checkout
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div>
      {status === 'pending_sale' && (
        <p className="text-sm bg-saddle-cream border border-saddle-tan rounded-md p-3 mb-3">
          Someone is checking out with this saddle right now. If they don&apos;t finish, it becomes
          available again within about 30 minutes.
        </p>
      )}
      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full bg-saddle-green text-white rounded-md py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Redirecting to checkout…' : `Buy Now — $${(priceCents / 100).toLocaleString()}`}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <p className="text-xs text-gray-500 mt-2">
        Payment is securely processed by Stripe and held for a 5-day inspection window that starts
        when the saddle is delivered. The seller isn&apos;t paid until you confirm it arrived as
        described (or the window passes). SaddleUp takes a 20% commission, capped at $500.
      </p>
    </div>
  );
}
