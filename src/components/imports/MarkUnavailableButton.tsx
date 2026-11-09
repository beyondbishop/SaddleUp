'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * For an imported saddle the seller hasn't claimed: "No longer available" takes it off SaddleUp but
 * keeps the record, so the same post shows up as a duplicate if anyone tries to add it again.
 * When it's already off, offers to put it back up.
 */
export default function MarkUnavailableButton({ listingId, unavailable }: { listingId: string; unavailable: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (!unavailable && !confirm('Mark this saddle as no longer available? It comes off SaddleUp, but stays in your imports so it won’t get added again.')) return;
    setSaving(true);
    const res = await fetch(`/api/imports/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unavailable: !unavailable })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) {
      alert(data?.error ?? 'Could not save. Please try again.');
      return;
    }
    router.refresh();
  }

  return (
    <button type="button" onClick={toggle} disabled={saving} className="underline text-saddle-brown">
      {saving ? 'Saving…' : unavailable ? 'Put it back up' : 'No longer available'}
    </button>
  );
}
