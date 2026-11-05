import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ConfirmReceiptButton from '@/components/ConfirmReceiptButton';
import ReviewForm from '@/components/ReviewForm';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: order } = await supabase
    .from('orders')
    .select('*, listings(model, seat_size, slug, brands(name)), reviews(id)')
    .eq('id', params.id)
    .eq('buyer_id', user.id)
    .single();

  if (!order) return notFound();

  const listing = (order as any).listings;
  const hasReview = (order as any).reviews?.length > 0;

  return (
    <div className="py-12 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">
        {listing?.seat_size}&quot; {listing?.brands?.name} {listing?.model}
      </h1>
      <p className="text-gray-600 mb-6">
        ${(order.sale_price_cents / 100).toLocaleString()} — purchased{' '}
        {new Date(order.created_at).toLocaleDateString()}
      </p>

      {order.payout_status === 'held' && order.confirmed_at && (
        <div className="bg-saddle-cream border border-saddle-tan rounded-lg p-5 mb-6">
          <p className="font-semibold mb-2">Thanks for confirming</p>
          <p className="text-sm">The seller&apos;s payout is being processed.</p>
        </div>
      )}

      {order.payout_status === 'held' && !order.confirmed_at && (
        <div className="bg-saddle-cream border border-saddle-tan rounded-lg p-5 mb-6">
          {order.release_at ? (
            <>
              <p className="font-semibold mb-2">You&apos;re in the inspection window</p>
              <p className="text-sm mb-4">
                Your payment is held safely until{' '}
                {new Date(order.release_at).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'America/New_York',
                  timeZoneName: 'short'
                })}{' '}
                — check that the saddle fits and matches the listing before then. If something&apos;s
                wrong, contact us before confirming. Otherwise, confirm receipt any time to release the
                seller&apos;s payout right away.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold mb-2">Waiting for delivery</p>
              <p className="text-sm mb-4">
                Your payment is held safely. Your 5-day inspection window starts when delivery is
                confirmed. If the saddle has arrived and you&apos;re happy with it, you can confirm
                receipt now to release the seller&apos;s payout.
              </p>
            </>
          )}
          <ConfirmReceiptButton orderId={order.id} />
        </div>
      )}

      {(order.payout_status === 'disputed' || order.payout_status === 'releasing') && (
        <p className="text-gray-600 mb-6">
          {order.payout_status === 'disputed'
            ? 'This order is under review.'
            : 'The seller\'s payout is being processed.'}
        </p>
      )}

      {order.status === 'refunded' && <p className="text-gray-600 mb-6">This order was refunded.</p>}

      {order.payout_status === 'transferred' && !hasReview && (
        <div className="bg-white border border-saddle-tan rounded-lg p-5">
          <p className="font-semibold mb-3">How was it?</p>
          <ReviewForm orderId={order.id} sellerId={order.seller_id} />
        </div>
      )}

      {order.payout_status === 'transferred' && hasReview && (
        <p className="text-gray-500">Thanks for your review!</p>
      )}
    </div>
  );
}
