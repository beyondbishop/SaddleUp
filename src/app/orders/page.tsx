import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function OrdersPage({ searchParams }: { searchParams: { purchased?: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/orders');

  const { data: orders } = await supabase
    .from('orders')
    .select('*, listings(model, seat_size, slug, brands(name))')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Your Orders</h1>
      {searchParams.purchased === '1' && (
        <p className="bg-saddle-cream border border-saddle-tan rounded-lg p-4 mb-6 text-sm">
          Payment received — thank you! Your order will appear here within a minute. Your payment is
          held until you&apos;ve had 5 days to inspect the saddle after delivery.
        </p>
      )}
      <div className="space-y-3">
        {orders?.map((o: any) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className="block bg-white border border-saddle-tan rounded-lg p-4 hover:shadow-md"
          >
            <p className="font-semibold">
              {o.listings?.seat_size}&quot; {o.listings?.brands?.name} {o.listings?.model}
            </p>
            <p className="text-sm text-gray-500">
              ${(o.sale_price_cents / 100).toLocaleString()} · {o.status === 'refunded'
                ? 'Refunded'
                : o.payout_status === 'transferred'
                  ? 'Complete'
                  : o.release_at
                    ? 'In inspection window'
                    : 'Awaiting delivery'}
            </p>
          </Link>
        ))}
        {orders?.length === 0 && <p className="text-gray-500">No orders yet.</p>}
      </div>
    </div>
  );
}
