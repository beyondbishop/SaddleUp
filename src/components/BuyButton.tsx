'use client';

import { useEffect, useState } from 'react';
import ReturnShippingNote from '@/components/orders/ReturnShippingNote';

type Quote = { quoteId: string; amountCents: number; service: string | null; days: number | null; zip: string };

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ZIP_KEY = 'saddleup:ship-zip';

/** Shipping quote by ZIP, total, and Buy Now. Checkout charges exactly the quote shown. */
export default function BuyButton({
  listingId,
  priceCents,
  status
}: {
  listingId: string;
  priceCents: number;
  status: string;
}) {
  const [zip, setZip] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
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

  // Remember the buyer's ZIP on this device and quote it straight away.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ZIP_KEY);
      if (saved && /^\d{5}$/.test(saved)) {
        setZip(saved);
        getQuote(saved);
      }
    } catch {
      // storage blocked: they type it
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  if (status !== 'active' && status !== 'pending_sale') {
    return <p className="font-semibold text-gray-600">This saddle is no longer available.</p>;
  }

  async function getQuote(z = zip) {
    if (!/^\d{5}$/.test(z)) return setError('Enter a 5-digit US ZIP code.');
    setQuoting(true);
    setError(null);
    setQuote(null);
    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, zip: z })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not get a shipping price.');
      setQuote(data);
      try {
        localStorage.setItem(ZIP_KEY, z);
      } catch {}
    } catch (e: any) {
      setError(e.message);
    } finally {
      setQuoting(false);
    }
  }

  async function handleBuy() {
    if (!quote) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, quoteId: quote.quoteId })
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        if (data.requote) setQuote(null);
        throw new Error(data.error ?? 'Checkout failed');
      }
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          getQuote();
        }}
        className="flex gap-2 items-end mb-3"
      >
        <div className="flex-1">
          <label htmlFor="ship-zip" className="block text-sm font-semibold mb-1">Shipping to ZIP</label>
          <input id="ship-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip}
            onChange={(e) => { setZip(e.target.value.replace(/\D/g, '')); setQuote(null); }}
            placeholder="e.g. 32034" className="w-full border rounded p-2" />
        </div>
        <button type="submit" disabled={quoting} className="border border-saddle-brown text-saddle-brown rounded px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {quoting ? 'Checking…' : 'Get shipping price'}
        </button>
      </form>

      {quote && (
        <dl className="text-sm grid grid-cols-[1fr_auto] gap-y-1 mb-3 bg-white border border-saddle-line rounded p-3">
          <dt>Saddle</dt>
          <dd className="text-right">{usd(priceCents)}</dd>
          <dt>
            Shipping to {quote.zip}
            <span className="block text-xs text-gray-500">
              {quote.service ?? 'Ground'}{quote.days ? `, about ${quote.days} business days after it ships` : ''}. Insured for the full
              price, signature on delivery.
            </span>
          </dt>
          <dd className="text-right">{usd(quote.amountCents)}</dd>
          <dt className="font-semibold border-t border-saddle-line pt-1">Total</dt>
          <dd className="text-right font-semibold border-t border-saddle-line pt-1">{usd(priceCents + quote.amountCents)}</dd>
        </dl>
      )}

      {quote && <ReturnShippingNote shippingCents={quote.amountCents} className="mb-3" />}

      <button
        onClick={handleBuy}
        disabled={loading || !quote}
        className="w-full bg-saddle-green text-white rounded-md py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Redirecting to checkout…' : quote ? `Buy Now — ${usd(priceCents + quote.amountCents)}` : 'Enter your ZIP to buy'}
      </button>
      {error && <p role="alert" className="text-red-600 text-sm mt-2">{error}</p>}
      <p className="text-xs text-gray-500 mt-2">
        Payment is processed by Stripe and held for a 5-day trial that starts when the carrier delivers the
        saddle. The seller isn&apos;t paid until you keep it or the trial ends. If you send it back, you pay
        return shipping unless it isn&apos;t as described. If the delivery address at
        checkout is in a different ZIP, SaddleUp covers any difference in shipping.
      </p>
    </div>
  );
}
