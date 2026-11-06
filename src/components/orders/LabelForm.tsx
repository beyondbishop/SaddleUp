'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type From = { name: string; street1: string; street2?: string | null; city: string; state: string; zip: string; phone?: string | null };

/** Seller's ship-from address -> buy the label (SaddleUp pays; the buyer paid shipping at checkout). */
export default function LabelForm({ orderId, saved, service }: { orderId: string; saved: From | null; service: string | null }) {
  const router = useRouter();
  const [f, setF] = useState<From>(saved ?? { name: '', street1: '', street2: '', city: '', state: '', zip: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof From) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sales/${orderId}/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: f })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'The label couldn’t be created. Please try again.');
    router.refresh();
  }

  const input = 'w-full border rounded p-2 text-sm';
  return (
    <form onSubmit={buy} className="space-y-2">
      <p className="text-sm">
        Your shipping label is paid for by SaddleUp{service ? ` (${service})` : ''}, with signature on delivery and insurance for
        the full sale price. Enter where you&apos;re shipping from:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs sm:col-span-2"><span className="font-semibold">Name</span>
          <input value={f.name} onChange={set('name')} required autoComplete="name" className={input} /></label>
        <label className="text-xs sm:col-span-2"><span className="font-semibold">Street address</span>
          <input value={f.street1} onChange={set('street1')} required autoComplete="address-line1" className={input} /></label>
        <label className="text-xs sm:col-span-2"><span className="font-semibold">Apt, barn, suite (optional)</span>
          <input value={f.street2 ?? ''} onChange={set('street2')} autoComplete="address-line2" className={input} /></label>
        <label className="text-xs"><span className="font-semibold">City</span>
          <input value={f.city} onChange={set('city')} required autoComplete="address-level2" className={input} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs"><span className="font-semibold">State</span>
            <input value={f.state} onChange={set('state')} required maxLength={2} placeholder="NC" autoComplete="address-level1" className={input} /></label>
          <label className="text-xs"><span className="font-semibold">ZIP</span>
            <input value={f.zip} onChange={set('zip')} required inputMode="numeric" autoComplete="postal-code" className={input} /></label>
        </div>
        <label className="text-xs sm:col-span-2"><span className="font-semibold">Phone (for the carrier)</span>
          <input value={f.phone ?? ''} onChange={set('phone')} type="tel" autoComplete="tel" className={input} /></label>
      </div>
      <button type="submit" disabled={busy} className="bg-saddle-green text-white rounded px-4 py-2 font-semibold text-sm disabled:opacity-50">
        {busy ? 'Creating label…' : 'Create shipping label'}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
