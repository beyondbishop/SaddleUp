import { EVENT_LABELS, ISSUE_REASONS, TIMELINE, formatDeadline, orderStage } from '@/lib/order-rules';
import { TREE_WIDTH_LABELS, type TreeWidth } from '@/lib/types';

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type OrderEvent = { id: number; type: string; actor: string; created_at: string; data: any };

/** Order header, timeline and history, shared by the buyer's and seller's order pages. */
export default function OrderView({ order, events, role }: { order: any; events: OrderEvent[]; role: 'buyer' | 'seller' | 'admin' }) {
  const snap = order.listing_snapshot ?? order.listings ?? {};
  const stage = orderStage(order);
  const currentIndex = TIMELINE.findIndex((t) => t.stage === stage);
  const issueLabel = order.issue_type
    ? (ISSUE_REASONS as any)[order.issue_type]?.[order.issue_reason] ?? order.issue_reason
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
            {role === 'seller' ? `Sale price ${usd(order.sale_price_cents)} · your payout ${usd(order.seller_payout_cents)}` : usd(order.sale_price_cents)}
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
        <ol className="flex flex-wrap gap-x-2 gap-y-1 text-sm" aria-label="Order progress">
          {TIMELINE.filter((t) => t.stage !== 'paid').map((t, i) => {
            const idx = TIMELINE.findIndex((x) => x.stage === t.stage);
            const done = idx < currentIndex;
            const current = idx === currentIndex;
            return (
              <li key={t.stage} aria-current={current ? 'step' : undefined}
                className={`px-2 py-1 rounded ${current ? 'bg-saddle-green text-white font-semibold' : done ? 'bg-saddle-cream text-saddle-brown' : 'bg-gray-100 text-gray-500'}`}>
                {done ? '✓ ' : ''}{t.label}
              </li>
            );
          })}
        </ol>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {order.dispatch_due_at && !order.delivered_at && stage !== 'refunded' && (
          <>
            <dt className="text-gray-500">{role === 'seller' ? 'Ship by' : 'Seller ships by'}</dt>
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
            <dt className="text-gray-500">Delivered</dt>
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
