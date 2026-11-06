import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { ISSUE_REASONS, formatDeadline } from '@/lib/order-rules';
import { MarkDeliveredForm, ResolveReviewForm } from '@/components/admin/OrderAdminActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders to review', robots: { index: false } };

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US')}`;

export default async function AdminOrdersPage() {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin/orders');
  if (!isAdmin) redirect('/');

  const admin = createAdminClient();
  const fields = '*, listings(model, seat_size, brands(name))';
  const nowIso = new Date().toISOString();
  const [reviews, overdue, inTransit, failed] = await Promise.all([
    admin.from('orders').select(fields).eq('review_status', 'open').order('issue_opened_at'),
    admin.from('orders').select(fields).eq('status', 'paid').is('shipped_at', null).is('delivered_at', null).lt('dispatch_due_at', nowIso).order('dispatch_due_at'),
    admin.from('orders').select(fields).eq('status', 'paid').not('shipped_at', 'is', null).is('delivered_at', null).order('shipped_at'),
    admin.from('orders').select(fields).eq('payout_status', 'held').not('payout_error', 'is', null)
  ]);
  const ids = [...new Set([...(reviews.data ?? []), ...(overdue.data ?? []), ...(inTransit.data ?? []), ...(failed.data ?? [])]
    .flatMap((o: any) => [o.buyer_id, o.seller_id]))];
  const { data: people } = ids.length ? await admin.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] as any[] };
  const who = new Map((people ?? []).map((p: any) => [p.id, p.full_name ? `${p.full_name} (${p.email})` : p.email]));

  const title = (o: any) => {
    const s = o.listing_snapshot ?? o.listings ?? {};
    return `${s.seat_size}" ${s.brands?.name ?? ''} ${s.model ?? ''} · ${usd(o.sale_price_cents)}`;
  };
  const parties = (o: any) => (
    <p className="text-xs text-gray-600">Buyer: {who.get(o.buyer_id)} · Seller: {who.get(o.seller_id)}</p>
  );
  const card = 'bg-white border border-saddle-line rounded p-4 space-y-2';

  return (
    <div className="py-8 max-w-3xl space-y-8">
      <h1 className="font-serif text-3xl text-saddle-ink">Orders to review</h1>

      <section>
        <h2 className="font-semibold text-saddle-brown mb-2">Returns and problems ({reviews.data?.length ?? 0})</h2>
        {!reviews.data?.length && <p className="text-sm text-gray-600">Nothing open.</p>}
        <div className="space-y-3">
          {(reviews.data ?? []).map((o: any) => (
            <div key={o.id} className={card}>
              <p className="font-semibold">{title(o)}</p>
              {parties(o)}
              <p className="text-sm">
                <strong>{o.issue_type === 'return_request' ? 'Return request' : 'Problem'}:</strong>{' '}
                {(ISSUE_REASONS as any)[o.issue_type]?.[o.issue_reason] ?? o.issue_reason} · {formatDeadline(o.issue_opened_at)}
              </p>
              <p className="text-sm whitespace-pre-wrap bg-saddle-sand rounded p-2">{o.issue_details}</p>
              {o.review_note && <p className="text-xs text-gray-600">Last note: {o.review_note}</p>}
              <ResolveReviewForm orderId={o.id} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-saddle-brown mb-2">Not shipped by the deadline ({overdue.data?.length ?? 0})</h2>
        {!overdue.data?.length && <p className="text-sm text-gray-600">None overdue.</p>}
        <div className="space-y-3">
          {(overdue.data ?? []).map((o: any) => (
            <div key={o.id} className={card}>
              <p className="font-semibold">{title(o)}</p>
              {parties(o)}
              <p className="text-sm text-red-700">Was due {formatDeadline(o.dispatch_due_at)}. Contact the seller; refund the buyer in Stripe if it won&apos;t ship.</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-saddle-brown mb-2">Shipped, waiting for delivery ({inTransit.data?.length ?? 0})</h2>
        <p className="text-xs text-gray-600 mb-2">Until Shippo tracking is connected, check the carrier&apos;s tracking and mark delivered here.</p>
        <div className="space-y-3">
          {(inTransit.data ?? []).map((o: any) => (
            <div key={o.id} className={card}>
              <p className="font-semibold">{title(o)}</p>
              {parties(o)}
              <p className="text-sm">{o.carrier} <span className="font-mono">{o.tracking_number}</span> · shipped {formatDeadline(o.shipped_at)}</p>
              <MarkDeliveredForm orderId={o.id} />
            </div>
          ))}
        </div>
      </section>

      {!!failed.data?.length && (
        <section>
          <h2 className="font-semibold text-saddle-brown mb-2">Payouts that failed ({failed.data.length})</h2>
          <div className="space-y-3">
            {failed.data.map((o: any) => (
              <div key={o.id} className={card}>
                <p className="font-semibold">{title(o)}</p>
                {parties(o)}
                <p className="text-sm text-red-700">{o.payout_error}. The daily job retries automatically.</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
