'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function FavoriteButton({
  listingId,
  className = ''
}: {
  listingId: string;
  className?: string;
}) {
  const supabase = createClient();
  const [isFavorited, setIsFavorited] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      if (data.user) {
        supabase
          .from('favorites')
          .select('listing_id')
          .eq('user_id', data.user.id)
          .eq('listing_id', listingId)
          .maybeSingle()
          .then(({ data: fav }) => setIsFavorited(!!fav));
      }
    });
  }, [listingId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) {
      window.location.href = '/auth/login';
      return;
    }
    setLoading(true);
    if (isFavorited) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId);
      setIsFavorited(false);
    } else {
      await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId });
      setIsFavorited(true);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      className={`bg-white/90 rounded-full w-9 h-9 flex items-center justify-center shadow ${className}`}
    >
      <span className={isFavorited ? 'text-red-500' : 'text-gray-400'}>
        {isFavorited ? '♥' : '♡'}
      </span>
    </button>
  );
}
