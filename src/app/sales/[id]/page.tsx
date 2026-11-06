import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import OrderView from '@/components/orders/OrderView';
import { orderStage } from '@/lib/order-rules';
import TrackingForm from '@/components/orders/TrackingForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sale', robots: { index: false } };

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/sales/${params.id}`);

  const { data: order } = await supabase
    .from('orders')
    .select('*, listings(model, seat_size, slug, tree_width, images, brands(name))')
    .eq('id', params.id)
    .eq('seller_id', user.id)
    .maybeSingle();
  if (!order) return notFound();

  const { data: events } = await supabase
    .from('order_events')
    .select('id, type, actor, created_at, data')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true });

  const stage = orderStage(order);

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6">
      <Link href="/sales" className="text-sm underline text-gray-600">← Your sales</Link>
      <OrderView order={order} events={events ?? []} role="seller" />

      {stage === 'awaiting_shipment' && (
        <section className="bg-saddle-cream border border-saddle-tan rounded-lg p-5 text-sm space-y-2">
          <h2 className="font-semibold">Packing and shipping</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Wrap the saddle in a saddle cover or soft cloth, then bubble wrap. Protect the pommel and cantle with extra padding.</li>
            <li>Use a sturdy box with at least 2 inches of padding on every side so the saddle can&apos;t shift.</li>
            <li>Take a few photos of the saddle and the packed box before sealing it. They protect you if there&apos;s a damage claim.</li>
            <li>Use tracked shipping with signature required and insurance for the full sale price.</li>
          </ul>
          <p className="text-gray-700">
            Shipping labels in SaddleUp are coming soon. For now, ship it yourself and add the tracking number here once the
            carrier has it.
          </p>
          <TrackingForm orderId={order.id} />
        </section>
      )}

      {stage === 'shipped' && (
        <section className="bg-white border border-saddle-line rounded-lg p-5 text-sm space-y-2">
          <p>
            Shipped with {order.carrier}, tracking <span className="font-mono">{order.tracking_number}</span>. The buyer&apos;s
            5-day inspection starts when delivery is confirmed.
          </p>
          <details>
            <summary className="cursor-pointer underline">Fix the tracking number</summary>
            <div className="mt-2">
              <TrackingForm orderId={order.id} current={{ carrier: order.carrier, tracking: order.tracking_number }} />
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
