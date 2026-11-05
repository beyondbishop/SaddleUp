'use client';

import { useEffect } from 'react';
import { goToSignIn } from '@/lib/return-to';
import { loadSaved, openPicker, useSavedState } from '@/lib/saved-store';

/** Heart: filled when the saddle is on any of the buyer's lists; opens the list picker. */
export default function FavoriteButton({ listingId, className = '' }: { listingId: string; className?: string }) {
  const { loaded, signedIn, ids } = useSavedState();
  const saved = ids.has(listingId);

  useEffect(() => {
    loadSaved();
  }, []);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loaded && !signedIn) {
      // After sign-in, come back here with the picker open for this saddle.
      const url = new URL(window.location.href);
      url.searchParams.set('save', listingId);
      goToSignIn(url.pathname + url.search);
      return;
    }
    openPicker(listingId);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={saved ? 'Saved to your lists. Change lists' : 'Save to a list'}
      className={`bg-white/90 rounded-full w-9 h-9 flex items-center justify-center shadow ${className}`}
    >
      <span aria-hidden="true" className={saved ? 'text-red-500' : 'text-gray-400'}>
        {saved ? '♥' : '♡'}
      </span>
    </button>
  );
}
