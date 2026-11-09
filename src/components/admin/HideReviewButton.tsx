'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Hide a review from the website, or show it again. */
export default function HideReviewButton({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: !hidden })
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} className="text-sm underline text-saddle-brown disabled:opacity-50">
      {busy ? '…' : hidden ? 'Show on site' : 'Hide from site'}
    </button>
  );
}
