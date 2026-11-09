import { EVENT_LABELS, ISSUE_REASONS, formatDeadline, isPickup, orderStage } from '@/lib/order-rules';
import { TREE_WIDTH_LABELS, type TreeWidth } from '@/lib/types';
import OrderProgress from '@/components/orders/OrderProgress';
import ReturnShippingNote from '@/components/orders/ReturnShippingNote';

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type OrderEvent = { id: number; type: string; actor: string; created_at: string; data: any };

/** Order header, timeline and history, shared by the buyer's and seller's order pages. */
export default function OrderView({ order, events, role }: { order: any; events: OrderEvent[]; role: 'buyer' | 'seller' | 'admin' }) {
  const snap = order.listing_snapshot ?? order.listings ?? {};
  const stage = orderStage(order);
  const pickup = isPickup(order);
  const issueLabel = order.issue_type
    ? order.issue_reason === 'delivery_exception'
      ? 'The carrier reported a delivery problem'
      : (ISSUE_REASONS as any)[order.issue_type]?.[order.issue_reason] ?? order.issue_reason
    : null;

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        {snap.images?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={snap.images[0]} alt="" className="w-24 h-24 object-cover rounded border border-saddle-line" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-saddle-brown">
            {snap.seat_size}&quot; {snap.brands?.name} {snap.model}
          </h1>
          <p className="text-gray-600 text-sm">
            {snap.tree_width ? `${TREE_WIDTH_LABELS[snap.tree_width as TreeWidth]} tree · ` : ''}
            {role === 'seller'
              ? `Sale price ${usd(order.sale_price_cents)} · your payout ${usd(order.seller_payout_cents)}`
              : pickup
                ? `${usd(order.sale_price_cents)} · local pickup`
                : order.shipping_cents
                ? `${usd(order.sale_price_cents)} + ${usd(order.shipping_cents)} shipping = ${usd(order.sale_price_cents + order.shipping_cents)}`
                : usd(order.sale_price_cents)}
          </p>
          <p className="text-gray-500 text-xs">Ordered {formatDeadline(order.created_at)}</p>
        </div>
      </div>

      {stage === 'refunded' ? (
        <p className="bg-saddle-cream border border-saddle-tan rounded p-3 text-sm">This order was refunded.</p>
      ) : stage === 'issue' ? (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm">
          <p className="font-semibold">
            {order.issue_type === 'return_request' ? 'Return requested' : 'Problem reported'}: {issueLabel}
          </p>
          <p className="mt-1">
            {role === 'seller'
              ? 'The buyer has asked SaddleUp to step in. Your payout is paused while we review it, and we’ll contact you.'
              : 'Thanks for letting us know. The seller’s payout is paused and SaddleUp will contact you about next steps.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <OrderProgress order={order} role={role} />
          {role === 'buyer' && stage !== 'completed' && stage !== 'kept' && (
            <ReturnShippingNote shippingCents={order.shipping_cents} pickup={pickup} />
          )}
        </div>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {order.dispatch_due_at && !order.delivered_at && stage !== 'refunded' && (
          <>
            <dt className="text-gray-500">{pickup ? 'Hand over by' : role === 'seller' ? 'Ship by' : 'Seller ships by'}</dt>
            <dd className={new Date(order.dispatch_due_at) < new Date() ? 'text-red-700 font-semibold' : ''}>
              {formatDeadline(order.dispatch_due_at)}
              {new Date(order.dispatch_due_at) < new Date() ? ' (overdue)' : ''}
            </dd>
          </>
        )}
        {order.tracking_number && (
          <>
            <dt className="text-gray-500">Tracking</dt>
            <dd>{order.carrier} <span className="font-mono">{order.tracking_number}</span></dd>
          </>
        )}
        {order.delivered_at && (
          <>
            <dt className="text-gray-500">{pickup ? 'Picked up' : 'Delivered'}</dt>
            <dd>{formatDeadline(order.delivered_at)}</dd>
          </>
        )}
        {order.release_at && stage !== 'completed' && stage !== 'refunded' && (
          <>
            <dt className="text-gray-500">Inspection ends</dt>
            <dd>{formatDeadline(order.release_at)}</dd>
          </>
        )}
        <dt className="text-gray-500">Seller payout</dt>
        <dd>
          {order.payout_status === 'transferred'
            ? 'Sent'
            : order.payout_status === 'releasing'
              ? 'Being sent'
              : order.payout_status === 'on_hold' || order.payout_status === 'disputed'
                ? 'Paused for review'
                : order.payout_status === 'cancelled'
                  ? 'Cancelled'
                  : order.payout_error && role !== 'buyer'
                    ? 'Failed, will retry'
                    : 'Held until the buyer keeps the saddle or inspection ends'}
        </dd>
      </dl>

      {role !== 'admin' && (
        <p className="text-xs text-gray-600">
          We email you at each step. <a href="/account/profile#notifications" className="underline">Get text updates too</a>
        </p>
      )}

      <section>
        <h2 className="font-semibold text-saddle-brown mb-2">History</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No updates yet.</p>
        ) : (
          <ol className="border-l-2 border-saddle-line pl-4 space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                <span className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</span>
                <span className="text-gray-500"> · {formatDeadline(e.created_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
