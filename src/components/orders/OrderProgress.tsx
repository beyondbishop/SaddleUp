import { PROGRESS_STEPS, formatDeadline, orderStage, progressIndex, type OrderLike } from '@/lib/order-rules';

type Props = {
  order: OrderLike & { dispatch_due_at?: string | null; created_at?: string | null };
  role: 'buyer' | 'seller' | 'admin';
};

/** Horizontal progress bar for an order: Paid → Shipped → Delivered → On trial → Complete. */
export default function OrderProgress({ order, role }: Props) {
  const stage = orderStage(order);
  const current = progressIndex(stage);
  if (current < 0) return null;

  // One line under the bar saying what happens next, worded for whoever is looking.
  const next: string =
    current === 1
      ? role === 'seller'
        ? `Ship it by ${formatDeadline(order.dispatch_due_at)}.`
        : `The seller ships by ${formatDeadline(order.dispatch_due_at)}.`
      : current === 2
        ? 'On its way. The 5-day trial starts when the carrier confirms delivery.'
        : current === 3
          ? role === 'seller'
            ? `Delivered. The buyer is trying the saddle until ${formatDeadline(order.release_at)}.`
            : `Delivered. Your 5-day trial ends ${formatDeadline(order.release_at)}.`
          : current === 4
            ? role === 'seller'
              ? 'The trial is over and the sale is final. Your payout is on its way.'
              : 'The trial is over and the saddle is yours.'
            : role === 'seller'
              ? 'Sale complete. Your payout has been sent.'
              : 'Sale complete. Enjoy your saddle!';

  return (
    <div aria-label="Order progress">
      <ol className="flex items-start">
        {PROGRESS_STEPS.map((label, i) => {
          const done = i < current;
          const isCurrent = i === current;
          return (
            <li key={label} aria-current={isCurrent ? 'step' : undefined} className="flex-1 flex flex-col items-center relative min-w-0">
              {/* Line joining this step to the previous one */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute top-3 right-1/2 w-full h-1 -translate-y-1/2 ${i <= current ? 'bg-saddle-green' : 'bg-gray-200'}`}
                />
              )}
              <span
                className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border-2 ${
                  done
                    ? 'bg-saddle-green border-saddle-green text-white'
                    : isCurrent
                      ? 'bg-white border-saddle-green text-saddle-green'
                      : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`mt-1 text-[11px] sm:text-xs text-center leading-tight ${
                  isCurrent ? 'font-semibold text-saddle-ink' : done ? 'text-saddle-brown' : 'text-gray-500'
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-saddle-muted mt-2">{next}</p>
    </div>
  );
}
