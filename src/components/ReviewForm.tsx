'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ReviewForm({ orderId, sellerId }: { orderId: string; sellerId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('reviews').insert({
      order_id: orderId,
      reviewer_id: user!.id,
      reviewee_id: sellerId,
      rating,
      comment
    });
    setSaving(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} className={n <= rating ? 'text-yellow-500' : 'text-gray-300'}>
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How was the fit, condition, communication?"
        rows={3}
        className="w-full border rounded p-2 text-sm"
      />
      <button type="submit" disabled={saving} className="bg-saddle-green text-white px-4 py-2 rounded-md font-semibold text-sm">
        {saving ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  );
}
