'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Deletes a listing (seller, admin, or the importer of an unclaimed one) after a confirm. */
export default function DeleteListingButton({
  listingId,
  label = 'Delete',
  redirectTo,
  className = 'underline text-red-600'
}: {
  listingId: string;
  label?: string;
  /** Where to go afterwards; refreshes the current page when left out. */
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this listing? It comes off SaddleUp right away and this can’t be undone.')) return;
    setLoading(true);
    const res = await fetch(`/api/listings/${listingId}`, { method: 'DELETE' }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setLoading(false);
    if (!res?.ok) {
      alert(data?.error ?? 'Could not delete the listing. Please try again.');
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <button type="button" onClick={handleDelete} disabled={loading} className={className}>
      {loading ? 'Deleting…' : label}
    </button>
  );
}
