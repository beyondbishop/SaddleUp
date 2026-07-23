'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function DeleteListingButton({ listingId }: { listingId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm('Remove this listing? This cannot be undone.')) return;
    setLoading(true);
    await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={handleDelete} disabled={loading} className="underline text-red-600">
      {loading ? 'Removing…' : 'Remove'}
    </button>
  );
}
