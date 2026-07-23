'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ModerationCard({ listing }: { listing: any }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function decide(status: 'active' | 'removed') {
    setLoading(true);
    await supabase.from('listings').update({ status }).eq('id', listing.id);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="bg-white border border-saddle-tan rounded-lg p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {listing.images?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt="" className="w-16 h-16 object-cover rounded" />
        )}
        <div>
          <p className="font-semibold">
            {listing.seat_size}&quot; {listing.brands?.name} {listing.model}
          </p>
          <p className="text-sm text-gray-500">
            {listing.tree_width} · ${(listing.price_cents / 100).toLocaleString()} ·{' '}
            {listing.location_city}, {listing.location_state}
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => decide('active')}
          disabled={loading}
          className="bg-saddle-green text-white px-3 py-1.5 rounded-md text-sm font-semibold"
        >
          Approve
        </button>
        <button
          onClick={() => decide('removed')}
          disabled={loading}
          className="bg-red-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
