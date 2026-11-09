import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import OrderView from '@/components/orders/OrderView';
import { formatDeadline, isPickup, orderStage } from '@/lib/order-rules';
import PickupHandover from '@/components/orders/PickupHandover';
import TrackingForm from '@/components/orders/TrackingForm';
import LabelForm from '@/components/orders/LabelForm';
import { shippoConfigured } from '@/lib/shippo';
import { createAdminClient } from '@/lib/supabase/server';
import ReviewForm from '@/components/ReviewForm';
import { GOOGLE_REVIEW_URL, saleIsFinal } from '@/lib/reviews';

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

  const [{ data: events }, { data: shipments }, { data: profile }] = await Promise.all([
    supabase.from('order_events').select('id, type, actor, created_at, data').eq('order_id', order.id).order('created_at', { ascending: true }),
    supabase
      .from('shipments')
      .select('id, source, carrier, tracking_number, tracking_url, status, accepted_at, delivered_at')
      .eq('order_id', order.id)
      .eq('direction', 'outbound'),
    supabase.from('profiles').select('ship_from').eq('id', user.id).maybeSingle()
  ]);

  const stage = orderStage(order);
  const { data: myReview } = await createAdminClient()
    .from('reviews')
    .select('rating, comment, share_ok')
    .eq('order_id', order.id)
    .eq('reviewer_role', 'seller')
    .maybeSingle();
  const shipment = shipments?.[0];
  const labelWaiting = shipment?.source === 'shippo_label' && !shipment.accepted_at;
  const canLabel = shippoConfigured() && !!(order.ship_to as any)?.street1;
  const pickup = isPickup(order);
  const buyerContact = pickup ? ((order.ship_to as { name?: string; phone?: string | null; email?: string | null } | null) ?? null) : null;

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6">
      <Link href="/sales" className="text-sm underline text-gray-600">← Your sales</Link>
      <OrderView order={order} events={events ?? []} role="seller" />

      {pickup && stage === 'awaiting_shipment' && (
        <section className="bg-saddle-cream border border-saddle-tan rounded-lg p-5 text-sm space-y-3">
          <h2 className="font-semibold">Local pickup: hand it over by {formatDeadline(order.dispatch_due_at)}</h2>
          <p>The buyer chose to collect the saddle in person, so there&apos;s nothing to ship. Contact them to agree a time and place:</p>
          <ul className="space-y-1">
            {buyerContact?.name && <li><span className="text-gray-600">Name:</span> {buyerContact.name}</li>}
            {buyerContact?.phone && <li><span className="text-gray-600">Phone:</span> <a className="underline" href={`tel:${buyerContact.phone}`}>{buyerContact.phone}</a></li>}
            {buyerContact?.email && <li><span className="text-gray-600">Email:</span> <a className="underline" href={`mailto:${buyerContact.email}`}>{buyerContact.email}</a></li>}
          </ul>
          <p className="text-gray-700">
            When the buyer has the saddle, tap the button below (or they can). Their 5-day trial starts then, and you&apos;re paid
            when they keep it or the trial ends.
          </p>
          <PickupHandover orderId={order.id} role="seller" />
        </section>
      )}

      {!pickup && stage === 'awaiting_shipment' && !shipment && (
        <section className="bg-saddle-cream border border-saddle-tan rounded-lg p-5 text-sm space-y-3">
          <h2 className="font-semibold">Pack and ship by {formatDeadline(order.dispatch_due_at)}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Wrap the saddle in a saddle cover or soft cloth, then bubble wrap. Protect the pommel and cantle with extra padding.</li>
            <li>Use a sturdy box with at least 2 inches of padding on every side so the saddle can&apos;t shift.</li>
            <li>Take a few photos of the saddle and the packed box before sealing it. They protect you if there&apos;s a damage claim.</li>
          </ul>
          {canLabel ? (
            <>
              <LabelForm orderId={order.id} saved={(profile?.ship_from as any) ?? null} service={null} />
              <details>
                <summary className="cursor-pointer underline">I&apos;d rather ship it myself</summary>
                <p className="mt-2 text-gray-700">
                  Ship with UPS or FedEx (not USPS), signature required and insurance for the full sale price, then add the tracking
                  number. Your own shipping costs aren&apos;t reimbursed.
                </p>
                <div className="mt-2"><TrackingForm orderId={order.id} /></div>
              </details>
            </>
          ) : (
            <>
              <p className="text-gray-700">Ship it with UPS or FedEx (not USPS), signature required and insured for the full sale price, then add the tracking number.</p>
              <TrackingForm orderId={order.id} />
            </>
          )}
        </section>
      )}

      {labelWaiting && (
        <section className="bg-saddle-cream border border-saddle-tan rounded-lg p-5 text-sm space-y-2">
          <h2 className="font-semibold">Your label is ready</h2>
          <a href={`/api/sales/${order.id}/label`} target="_blank" rel="noopener noreferrer"
            className="inline-block bg-saddle-green text-white rounded px-4 py-2 font-semibold">Print shipping label (PDF)</a>
          <p>
            Tape it to the box and drop it off with {shipment!.carrier.toUpperCase()} by {formatDeadline(order.dispatch_due_at)}.
            The order shows as shipped once the carrier scans it. Tracking {shipment!.tracking_number}.
          </p>
        </section>
      )}

      {stage === 'shipped' && shipment?.source === 'manual' && (
        <section className="bg-white border border-saddle-line rounded-lg p-5 text-sm space-y-2">
          <p>The buyer&apos;s 5-day inspection starts when the carrier confirms delivery.</p>
          <details>
            <summary className="cursor-pointer underline">Fix the tracking number</summary>
            <div className="mt-2">
              <TrackingForm orderId={order.id} current={{ carrier: order.carrier, tracking: order.tracking_number }} />
            </div>
          </details>
        </section>
      )}

      {saleIsFinal(order) && (
        <section className="bg-white border border-saddle-tan rounded-lg p-5">
          <h2 className="font-semibold mb-1">{myReview ? 'Your review of SaddleUp' : 'How was selling on SaddleUp?'}</h2>
          <p className="text-sm text-saddle-muted mb-3">I read every one. It helps me make selling easier.</p>
          <ReviewForm orderId={order.id} role="seller" initial={myReview ?? null} googleReviewUrl={GOOGLE_REVIEW_URL} />
        </section>
      )}
    </div>
  );
}
