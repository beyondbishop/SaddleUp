'use client';

import { useState } from 'react';

export default function BuyButton({
  listingId,
  priceCents
}: {
  listingId: string;
  priceCents: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full bg-saddle-green text-white rounded-md py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Redirecting to checkout…' : `Buy Now — $${(priceCents / 100).toLocaleString()}`}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <p className="text-xs text-gray-500 mt-2">
        Payment is securely processed by Stripe and held for a 5-day inspection window —
        the seller isn&apos;t paid until you confirm the saddle arrived as described (or the
        window passes). SaddleUp takes a 20% commission, capped at $500.
      </p>
    </div>
  );
}
