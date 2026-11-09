import { createAdminClient } from '@/lib/supabase/server';
import HideReviewButton from '@/components/admin/HideReviewButton';
import { GOOGLE_REVIEW_URL } from '@/lib/reviews';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reviews · Admin', robots: { index: false } };

// Every review, newest first, with where it shows on the site. The admin layout checks access.
export default async function AdminReviewsPage() {
  const { data: reviews, error } = await createAdminClient()
    .from('reviews')
    .select('id, order_id, rating, comment, reviewer_role, reviewer_first_name, saddle_label, share_ok, hidden, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="py-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-saddle-brown">Reviews</h1>
      <p className="text-saddle-muted mt-1 text-sm">
        Buyers rate the seller and the experience; sellers rate SaddleUp. 5-star reviews with words, where the reviewer said
        we could share them, show on the homepage. Buyers’ ratings also show on the seller’s profile and listings. Hide
        anything you don’t want on the site.
      </p>
      <p className="text-sm mt-2">
        Google review link:{' '}
        {GOOGLE_REVIEW_URL ? (
          <a href={GOOGLE_REVIEW_URL} className="underline text-saddle-brown" target="_blank" rel="noopener noreferrer">set</a>
        ) : (
          <span className="text-red-700">not set (add NEXT_PUBLIC_GOOGLE_REVIEW_URL in Vercel to ask reviewers to post on Google)</span>
        )}
      </p>

      {error && (
        <p className="mt-6 bg-red-50 border border-red-200 rounded p-3 text-sm">
          Reviews can’t load yet. Run supabase/migrations/20261120_reviews_share.sql in Supabase.
        </p>
      )}
      <div className="mt-6 space-y-3">
        {(reviews ?? []).map((r) => {
          const onHomepage = r.rating === 5 && r.share_ok && !r.hidden && !!r.comment?.trim();
          return (
            <div key={r.id} className={`bg-white border rounded-lg p-4 ${r.hidden ? 'border-gray-200 opacity-60' : 'border-saddle-tan'}`}>
              <div className="flex justify-between gap-3">
                <p className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                <HideReviewButton id={r.id} hidden={r.hidden} />
              </div>
              {r.comment && <p className="text-sm mt-1">“{r.comment}”</p>}
              <p className="text-xs text-saddle-muted mt-2">
                {r.reviewer_first_name ?? 'Someone'} ({r.reviewer_role === 'seller' ? 'seller, about SaddleUp' : 'buyer, about the seller'}) ·{' '}
                {r.saddle_label} · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-xs mt-1">
                {r.hidden
                  ? 'Hidden from the site'
                  : [onHomepage && 'On the homepage', r.reviewer_role === 'buyer' && 'In the seller’s rating', !r.share_ok && 'Words not shared (reviewer said no)']
                      .filter(Boolean)
                      .join(' · ') || 'Not shown publicly'}
              </p>
            </div>
          );
        })}
        {!error && reviews?.length === 0 && <p className="text-gray-500">No reviews yet.</p>}
      </div>
    </div>
  );
}
