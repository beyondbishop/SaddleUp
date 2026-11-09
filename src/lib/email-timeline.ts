// The "where your sale is" timeline used in order emails: one bar split into the five parts of
// the buying process, each with its date, and the step the reader is on in a different colour.
// Email-safe HTML (tables + inline styles), plus a plain-text version.

export type TimelineRole = 'buyer' | 'seller';

export type TimelineOrder = {
  created_at?: string | null;
  dispatch_due_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  release_at?: string | null;
  kept_at?: string | null;
  confirmed_at?: string | null;
  payout_status?: string | null;
};

const DAY = 864e5;
const TZ = 'America/New_York';
const GREEN = '#2f4a3a'; // done
const HERE = '#b8742a'; // where they are now
const TODO = '#e6dccf'; // still to come

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });

type Step = { label: string; date: string };

/**
 * The five steps with real dates where we have them and estimates (marked "est.") where we don't.
 * `transitDays` is the carrier's estimate from the shipping quote.
 */
export function timelineSteps(order: TimelineOrder, role: TimelineRole, transitDays = 5): Step[] {
  const sold = order.created_at ? new Date(order.created_at) : new Date();
  const shipBy = order.dispatch_due_at ? new Date(order.dispatch_due_at) : new Date(sold.getTime() + 3 * DAY);
  const shipped = order.shipped_at ? new Date(order.shipped_at) : null;
  const delivered = order.delivered_at ? new Date(order.delivered_at) : null;
  const estDelivery = delivered ?? new Date((shipped ?? shipBy).getTime() + transitDays * DAY);
  // The trial end is only known once the carrier has confirmed delivery.
  const trialKnown = !!(delivered && order.release_at);
  const trialEnd = trialKnown ? new Date(order.release_at!) : new Date(estDelivery.getTime() + 5 * DAY);
  const est = (actual: unknown, d: Date) => (actual ? shortDate(d) : `est. ${shortDate(d)}`);

  return [
    { label: role === 'seller' ? 'Sold' : 'Ordered', date: shortDate(sold) },
    { label: role === 'seller' && !shipped ? 'Ship it' : 'Shipped', date: shipped ? shortDate(shipped) : `by ${shortDate(shipBy)}` },
    { label: 'Delivered', date: est(delivered, estDelivery) },
    { label: '5-day trial', date: `ends ${est(trialKnown, trialEnd)}` },
    { label: role === 'seller' ? 'You’re paid' : 'It’s yours', date: est(trialKnown, trialEnd) }
  ];
}

/** Which step (0–4) the reader is on now, from what has happened on the order. */
export function currentStep(order: TimelineOrder): number {
  if (order.payout_status === 'transferred' || order.kept_at || order.confirmed_at) return 4;
  if (order.delivered_at) return 3;
  if (order.shipped_at) return 2;
  return 1; // paid, waiting to ship
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The timeline as email HTML. `current` defaults to where the order is now. */
export function timelineHtml(order: TimelineOrder, role: TimelineRole, opts: { transitDays?: number; current?: number } = {}) {
  const steps = timelineSteps(order, role, opts.transitDays);
  const current = opts.current ?? currentStep(order);
  const cells = steps
    .map((s, i) => {
      const color = i < current ? GREEN : i === current ? HERE : TODO;
      const text = i < current ? GREEN : i === current ? HERE : '#8a7b6b';
      const mark = i < current ? '✓ ' : '';
      return `<td width="20%" style="width:20%;padding:0 2px;vertical-align:top;font-family:Georgia,serif">
        <div style="height:8px;line-height:8px;font-size:0;background:${color};border-radius:4px">&nbsp;</div>
        <div style="font-size:13px;line-height:1.3;margin-top:6px;color:${text};font-weight:${i <= current ? 'bold' : 'normal'}">${mark}${esc(s.label)}</div>
        <div style="font-size:11px;line-height:1.3;color:${i === current ? HERE : '#8a7b6b'}">${esc(s.date)}</div>
        ${i === current ? `<div style="display:inline-block;margin-top:4px;padding:1px 6px;border-radius:8px;background:${HERE};color:#fff;font-size:10px;font-weight:bold;letter-spacing:.03em">YOU ARE HERE</div>` : ''}
      </td>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;table-layout:fixed;margin:4px 0 20px"><tr>${cells}</tr></table>`;
}

/** The timeline for the plain-text email. */
export function timelineText(order: TimelineOrder, role: TimelineRole, opts: { transitDays?: number; current?: number } = {}) {
  const steps = timelineSteps(order, role, opts.transitDays);
  const current = opts.current ?? currentStep(order);
  return steps
    .map((s, i) => `${i < current ? '[x]' : i === current ? '[>]' : '[ ]'} ${s.label}: ${s.date}${i === current ? '  <- you are here' : ''}`)
    .join('\n');
}
