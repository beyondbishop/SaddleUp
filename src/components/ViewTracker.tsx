'use client';

import { useEffect } from 'react';

/** Records one view of a listing page for the seller's stats. Renders nothing. */
export default function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ listingId, referrer: document.referrer });
    // keepalive lets the request finish even if the visitor clicks away immediately.
    fetch('/api/listings/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  }, [listingId]);
  return null;
}
