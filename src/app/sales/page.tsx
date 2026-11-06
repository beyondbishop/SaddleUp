import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TIMELINE, formatDeadline, orderStage } from '@/lib/order-rules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your sales', robots: { index: false } };

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US')}`;
const STAGE_TEXT: Record<string, string> = {
  ...Object.fromEntries(TIMELINE.map((t) => [t.stage, t.label])),
  issue: 'Under review',
  refunded: 'Refunded'
};

export default async function SalesPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/sales');

  const { data: orders } = await supabase
    .from('orders')
    .select('*, listings(model, seat_size, brands(name))')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Your sales</h1>
      <div className="space-y-3">
        {(orders ?? []).map((o: any) => {
          const snap = o.listing_snapshot ?? o.listings ?? {};
          const stage = orderStage(o);
          const overdue = stage === 'awaiting_shipment' && o.dispatch_due_at && new Date(o.dispatch_due_at) < new Date();
          return (
            <Link key={o.id} href={`/sales/${o.id}`} className="block bg-white border border-saddle-tan rounded-lg p-4 hover:shadow-md">
              <p className="font-semibold">{snap.seat_size}&quot; {snap.brands?.name} {snap.model}</p>
              <p className="text-sm text-gray-600">
                {usd(o.sale_price_cents)} · {STAGE_TEXT[stage] ?? stage}
                {stage === 'awaiting_shipment' && o.dispatch_due_at && (
                  <span className={overdue ? 'text-red-700 font-semibold' : ''}> · ship by {formatDeadline(o.dispatch_due_at)}{overdue ? ' (overdue)' : ''}</span>
                )}
              </p>
            </Link>
          );
        })}
        {orders?.length === 0 && <p className="text-gray-500">No sales yet.</p>}
      </div>
    </div>
  );
}
