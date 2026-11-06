import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import ReviewForm from '@/components/ReviewForm';
import OrderView from '@/components/orders/OrderView';
import BuyerActions from '@/components/orders/BuyerActions';
import { formatDeadline } from '@/lib/order-rules';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/orders/${params.id}`);

  const { data: order } = await supabase
    .from('orders')
    .select('*, listings(model, seat_size, slug, tree_width, images, brands(name)), reviews(id)')
    .eq('id', params.id)
    .eq('buyer_id', user.id)
    .maybeSingle();
  if (!order) return notFound();

  const { data: events } = await supabase
    .from('order_events')
    .select('id, type, actor, created_at, data')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true });

  const hasReview = (order as any).reviews?.length > 0;
  const now = Date.now();
  const open = order.status === 'paid' && order.payout_status === 'held' && !order.issue_type;
  const inspectionOpen = !!order.delivered_at && !!order.release_at && now < new Date(order.release_at).getTime();
  const windowClosed = !!order.release_at && now >= new Date(order.release_at).getTime();

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6">
      <Link href="/orders" className="text-sm underline text-gray-600">← Your orders</Link>
      <OrderView order={order} events={events ?? []} role="buyer" />

      {open && (
        <BuyerActions
          orderId={order.id}
          // Keep is allowed any time before payout (e.g. collected in person or already happy).
          canKeep
          canReturn={inspectionOpen}
          canReport={!windowClosed}
          inspectionEnds={inspectionOpen ? formatDeadline(order.release_at) : null}
        />
      )}

      {order.payout_status === 'transferred' && !hasReview && (
        <div className="bg-white border border-saddle-tan rounded-lg p-5">
          <p className="font-semibold mb-3">How was it?</p>
          <ReviewForm orderId={order.id} sellerId={order.seller_id} />
        </div>
      )}
      {order.payout_status === 'transferred' && hasReview && <p className="text-gray-500">Thanks for your review!</p>}
    </div>
  );
}
