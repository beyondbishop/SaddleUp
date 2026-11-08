'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** One brand someone added: approve it (fixing the spelling if needed) or merge it into a brand we have. */
export default function BrandReviewRow({
  brand,
  others
}: {
  brand: { id: number; name: string };
  others: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(brand.name);
  const [into, setInto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/brands/${brand.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'Something went wrong.');
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={`brand-${brand.id}`} className="block text-xs text-saddle-muted mb-1">Spelling</label>
        <input id={`brand-${brand.id}`} value={name} onChange={(e) => setName(e.target.value)} className="border rounded p-2 text-sm w-56" />
      </div>
      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={() => send({ action: 'approve', name: name.trim() !== brand.name ? name : undefined })}
        className="bg-saddle-green text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {name.trim() !== brand.name ? 'Fix spelling & approve' : 'Approve'}
      </button>
      <span className="text-sm text-saddle-muted pb-2">or</span>
      <div>
        <label htmlFor={`merge-${brand.id}`} className="block text-xs text-saddle-muted mb-1">Same as</label>
        <select id={`merge-${brand.id}`} value={into} onChange={(e) => setInto(e.target.value)} className="border rounded p-2 text-sm">
          <option value="">Pick a brand…</option>
          {others.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <button
        type="button"
        disabled={busy || !into}
        onClick={() => confirm(`Move its listings to ${others.find((b) => String(b.id) === into)?.name} and delete “${brand.name}”?`) && send({ action: 'merge', into: Number(into) })}
        className="border border-saddle-brown text-saddle-brown rounded px-3 py-2 text-sm font-semibold disabled:opacity-50"
      >
        Merge
      </button>
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
    </div>
  );
}
