'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Carriers we track automatically. "Other" takes any carrier name; the buyer then confirms receipt. */
export const TRACKED_CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL'];

export default function TrackingForm({ orderId, current }: { orderId: string; current?: { carrier: string | null; tracking: string | null } }) {
  const router = useRouter();
  const known = !current?.carrier || TRACKED_CARRIERS.includes(current.carrier);
  const [carrier, setCarrier] = useState(known ? current?.carrier ?? '' : 'Other');
  const [otherName, setOtherName] = useState(known ? '' : current?.carrier ?? '');
  const [tracking, setTracking] = useState(current?.tracking ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOther = carrier === 'Other';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sales/${orderId}/tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrier, carrierName: isOther ? otherName : undefined, trackingNumber: tracking })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not save. Please try again.');
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-wrap gap-2 items-end">
      <div>
        <label htmlFor="carrier" className="block text-xs font-semibold">Carrier</label>
        <select id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} required className="border rounded p-2 text-sm">
          <option value="">Choose…</option>
          {TRACKED_CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="Other">Other</option>
        </select>
      </div>
      {isOther && (
        <div>
          <label htmlFor="carrier-name" className="block text-xs font-semibold">Carrier name</label>
          <input id="carrier-name" value={otherName} onChange={(e) => setOtherName(e.target.value)} required maxLength={40}
            placeholder="e.g. a saddle courier" className="border rounded p-2 text-sm" />
        </div>
      )}
      <div className="flex-1 min-w-[12rem]">
        <label htmlFor="tracking" className="block text-xs font-semibold">Tracking number</label>
        <input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} required maxLength={60}
          className="w-full border rounded p-2 text-sm" />
      </div>
      <button type="submit" disabled={busy} className="bg-saddle-green text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-50">
        {busy ? 'Saving…' : current?.tracking ? 'Update tracking' : 'It’s shipped'}
      </button>
      {isOther && (
        <p className="w-full text-xs text-gray-700">
          We can&apos;t follow this carrier automatically, so the buyer confirms when the saddle arrives. Their 5-day trial starts then.
        </p>
      )}
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}
