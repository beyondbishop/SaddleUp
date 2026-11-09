import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { orderStage } from '@/lib/order-rules';
import OrderProgress from '@/components/orders/OrderProgress';

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "17.5" Devoucoux Chiberta", leaving out a missing or "Other" brand. */
function saddleName(snap: any) {
  const brand = snap?.brands?.name && snap.brands.name !== 'Other' ? `${snap.brands.name} ` : '';
  return `${snap?.seat_size ? `${snap.seat_size}" ` : ''}${brand}${snap?.model ?? 'Saddle'}`;
}

export default async function OrdersPage({ searchParams }: { searchParams: { purchased?: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/orders');

  // The saddle's details come from the copy saved with the order: once a saddle sells, its
  // listing isn't readable by the buyer any more (and the copy is exactly what they bought).
  const { data: orders } = await supabase
    .from('orders')
    .select('*, listings(model, seat_size, slug, images, brands(name))')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Your Orders</h1>
      {searchParams.purchased === '1' && (
        <div className="bg-saddle-cream border border-saddle-tan rounded-lg p-4 mb-6 text-sm space-y-1">
          <p className="font-semibold text-saddle-ink">🎉 Payment received. Thank you!</p>
          <p>
            Your order shows below within a minute, and a confirmation email is on its way. Your payment is held
            safely until your 5-day trial, which starts when the saddle is delivered, is over.
          </p>
        </div>
      )}
      <div className="space-y-4">
        {orders?.map((o: any) => {
          const snap = o.listing_snapshot ?? o.listings ?? {};
          const stage = orderStage(o);
          const image = snap.images?.[0];
          return (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="block bg-white border border-saddle-tan rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 items-start">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="w-20 h-20 object-cover rounded border border-saddle-line shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded border border-saddle-line bg-saddle-cream shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-saddle-ink">{saddleName(snap)}</p>
                  <p className="text-sm text-saddle-muted">
                    {o.shipping_cents ? `${usd(o.sale_price_cents + o.shipping_cents)} incl. shipping` : usd(o.sale_price_cents)}
                    {' · '}Ordered {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {stage === 'refunded' && <p className="text-sm mt-1">Refunded</p>}
                  {stage === 'issue' && <p className="text-sm mt-1">SaddleUp is reviewing this order. We’ll be in touch.</p>}
                </div>
              </div>
              {stage !== 'refunded' && stage !== 'issue' && (
                <div className="mt-4">
                  <OrderProgress order={o} role="buyer" />
                </div>
              )}
            </Link>
          );
        })}
        {orders?.length === 0 && (
          <p className="text-gray-500">
            No orders yet. <Link href="/saddles" className="underline text-saddle-brown">Browse saddles</Link>
          </p>
        )}
      </div>
    </div>
  );
}
