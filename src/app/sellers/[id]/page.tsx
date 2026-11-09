import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import SaddleCard from '@/components/SaddleCard';
import { Listing } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { getSellerFace } from '@/lib/avatar';
import { isUuid } from '@/lib/lists-server';
import { sellerRating } from '@/lib/reviews';

export default async function SellerProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // Profiles are private, so only the public bits (first name, photo, join date) are read here.
  const seller = isUuid(params.id) ? await getSellerFace(params.id) : null;
  if (!seller) return notFound();

  // Buyers' ratings (hidden ones left out); quotes only from buyers who said we could share them.
  const rating = await sellerRating(params.id);

  const { data: listings } = await supabase
    .from('listings')
    .select('*, brands(name, slug)')
    .eq('seller_id', params.id)
    .eq('status', 'active');

  const avgRating = rating.average?.toFixed(1) ?? null;

  return (
    <div className="py-8">
      <div className="flex items-center gap-4 mb-2">
        <Avatar url={seller.avatarUrl} initials={seller.initials} size={88} />
        <div>
          <h1 className="text-2xl font-bold text-saddle-brown mb-1">{seller.firstName}</h1>
          <p className="text-gray-500">Selling on SaddleUp since {new Date(seller.memberSince).getFullYear()}</p>
        </div>
      </div>
      {avgRating ? (
        <p className="mb-6">
          <span className="text-amber-500">★</span> {avgRating} ({rating.count} review
          {rating.count === 1 ? '' : 's'} from buyers)
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

      {rating.all.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-3">What buyers say</h2>
          <div className="space-y-3">
            {rating.all.map((r) => (
              <figure key={r.id} className="bg-white border border-saddle-tan rounded-lg p-4">
                <p className="text-amber-500 mb-1" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                {/* Words are shown only when the buyer agreed to share them. */}
                {rating.quotes.some((q) => q.id === r.id) && <blockquote className="text-sm">“{r.comment}”</blockquote>}
                <figcaption className="text-xs text-saddle-muted mt-1">
                  {rating.quotes.some((q) => q.id === r.id) && r.reviewer_first_name ? `${r.reviewer_first_name}, ` : ''}
                  bought {r.saddle_label ? `a ${r.saddle_label}` : 'a saddle'} ·{' '}
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
