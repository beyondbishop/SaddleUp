import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import SaddleCard from '@/components/SaddleCard';
import { Listing } from '@/lib/types';

export default async function SellerProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: seller } = await supabase.from('profiles').select('id, full_name, created_at').eq('id', params.id).single();
  if (!seller) return notFound();

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewee_id', params.id)
    .order('created_at', { ascending: false });

  const { data: listings } = await supabase
    .from('listings')
    .select('*, brands(name, slug)')
    .eq('seller_id', params.id)
    .eq('status', 'active');

  const avgRating = reviews?.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-saddle-brown mb-1">{seller.full_name}</h1>
      <p className="text-gray-500 mb-2">
        Selling on SaddleUp since {new Date(seller.created_at).getFullYear()}
      </p>
      {avgRating ? (
        <p className="mb-6">
          <span className="text-yellow-500">★</span> {avgRating} ({reviews!.length} review
          {reviews!.length === 1 ? '' : 's'})
        </p>
      ) : (
        <p className="text-gray-400 mb-6">No reviews yet</p>
      )}

      <h2 className="text-xl font-semibold mb-3">Active Listings</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {(listings as unknown as Listing[] | null)?.map((l) => (
          <SaddleCard key={l.id} listing={l} />
        ))}
        {listings?.length === 0 && <p className="text-gray-500">No active listings right now.</p>}
      </div>

      {reviews && reviews.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-3">Reviews</h2>
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white border border-saddle-tan rounded-lg p-4">
                <p className="text-yellow-500 mb-1">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                {r.comment && <p className="text-sm">{r.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
