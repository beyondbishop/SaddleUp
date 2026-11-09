import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';
import ReviewForm from '@/components/ReviewForm';
import { GOOGLE_REVIEW_URL, saddleLabel, saleIsFinal } from '@/lib/reviews';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rate your experience', robots: { index: false } };

// Where the stars in the end-of-sale emails go: /review/<order id>?rating=1..5
export default async function ReviewPage({ params, searchParams }: { params: { orderId: string }; searchParams: { rating?: string } }) {
  const stars = Number(searchParams.rating);
  const initialRating = Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : null;
  const { user } = await getViewer();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/review/${params.orderId}${initialRating ? `?rating=${initialRating}` : ''}`)}`);
  if (!isUuid(params.orderId)) return notFound();

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, payout_status, confirmed_at, kept_at, listing_snapshot')
    .eq('id', params.orderId)
    .maybeSingle();
  const role = order?.buyer_id === user.id ? 'buyer' : order?.seller_id === user.id ? 'seller' : null;
  if (!order || !role) return notFound();

  const { data: existing } = await admin
    .from('reviews')
    .select('rating, comment, share_ok')
    .eq('order_id', order.id)
    .eq('reviewer_role', role)
    .maybeSingle();

  const saddle = saddleLabel(order.listing_snapshot);
  const image = (order.listing_snapshot as any)?.images?.[0];
  const back = role === 'buyer' ? `/orders/${order.id}` : `/sales/${order.id}`;

  return (
    <div className="py-10 max-w-xl mx-auto">
      <div className="flex gap-4 items-center mb-6">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="w-20 h-20 object-cover rounded border border-saddle-line" />
        )}
        <div>
          <p className="text-sm text-saddle-muted">{role === 'buyer' ? 'Your purchase' : 'Your sale'}</p>
          <p className="font-semibold text-saddle-ink">{saddle}</p>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">
        {role === 'buyer' ? 'How was your saddle and the seller?' : 'How was selling on SaddleUp?'}
      </h1>
      <p className="text-saddle-muted mb-6">
        {role === 'buyer'
          ? 'Your rating helps other riders buy with confidence, and it goes on the seller’s profile.'
          : 'I read every one, and it helps me make SaddleUp better for sellers. Thank you! — Danielle'}
      </p>
      {saleIsFinal(order) ? (
        <ReviewForm orderId={order.id} role={role} initialRating={initialRating} initial={existing ?? null} googleReviewUrl={GOOGLE_REVIEW_URL} />
      ) : (
        <p className="bg-saddle-cream border border-saddle-tan rounded p-4 text-sm">
          You can rate this sale once it’s final, when the buyer keeps the saddle or the 5-day trial ends.
        </p>
      )}
      <p className="mt-8 text-sm">
        <Link href={back} className="underline text-saddle-brown">← Back to your {role === 'buyer' ? 'order' : 'sale'}</Link>
      </p>
    </div>
  );
}
