// Order rules and labels with no server dependencies, safe to use in the browser.

export const BUSINESS_TZ = 'America/New_York'; // placeholder until the business-day calendar is decided
export const DISPATCH_BUSINESS_DAYS = 3;
export const BUYER_TERMS_VERSION = '2026-11-07';

/** Offset (ms) of a timezone from UTC at a given instant. */
function tzOffsetMs(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(at).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - at.getTime();
}

/**
 * End of the Nth business day after `from`, in the business timezone (Mon–Fri; holidays not yet
 * counted). E.g. paid Friday 3pm with 3 days -> due Wednesday 11:59pm Eastern.
 */
export function addBusinessDays(from: Date, days: number, timeZone = BUSINESS_TZ): Date {
  const local = new Date(from.getTime() + tzOffsetMs(from, timeZone)); // wall-clock as UTC fields
  let y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  let added = 0;
  while (added < days) {
    const next = new Date(Date.UTC(y, m, d + 1));
    y = next.getUTCFullYear(); m = next.getUTCMonth(); d = next.getUTCDate();
    const dow = next.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  const wallEnd = Date.UTC(y, m, d, 23, 59, 59);
  // Convert the local 23:59:59 back to an instant (offset taken at that moment, DST-safe enough).
  return new Date(wallEnd - tzOffsetMs(new Date(wallEnd), timeZone));
}

export function formatDeadline(iso: string | null | undefined, timeZone = BUSINESS_TZ) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone, timeZoneName: 'short' });
}

export const ISSUE_REASONS = {
  return_request: {
    fit: 'Doesn’t fit my horse or me',
    changed_mind: 'Changed my mind',
    not_as_described: 'Not as described (condition, size or model)',
    suspected_broken_tree: 'I think the tree is broken'
  },
  problem: {
    transit_damage: 'Damaged in shipping',
    not_arrived: 'It hasn’t arrived',
    wrong_item: 'Wrong saddle',
    other: 'Something else'
  }
} as const;

export type Stage = 'paid' | 'awaiting_shipment' | 'shipped' | 'inspection' | 'kept' | 'issue' | 'completed' | 'refunded';

export interface OrderLike {
  status: string;
  payout_status: string;
  delivered_at?: string | null;
  release_at?: string | null;
  kept_at?: string | null;
  confirmed_at?: string | null;
  issue_type?: string | null;
  review_status?: string | null;
  shipped_at?: string | null;
}

/** Where the order is, for the timeline. */
export function orderStage(o: OrderLike): Stage {
  if (o.status === 'refunded') return 'refunded';
  if (o.payout_status === 'transferred') return 'completed';
  if (o.issue_type && o.review_status === 'open') return 'issue';
  if (o.kept_at || o.confirmed_at) return 'kept';
  if (o.delivered_at) return 'inspection';
  if (o.shipped_at) return 'shipped';
  return 'awaiting_shipment';
}

export const TIMELINE: { stage: Stage; label: string }[] = [
  { stage: 'paid', label: 'Paid' },
  { stage: 'awaiting_shipment', label: 'Awaiting shipment' },
  { stage: 'shipped', label: 'Shipped' },
  { stage: 'inspection', label: 'Delivered: inspection open' },
  { stage: 'kept', label: 'Kept' },
  { stage: 'completed', label: 'Completed' }
];

export const EVENT_LABELS: Record<string, string> = {
  paid: 'Payment received',
  dispatch_overdue: 'Dispatch deadline passed',
  shipped: 'Handed to the carrier',
  delivered: 'Delivered: 5-day inspection started',
  kept: 'Buyer kept the saddle',
  inspection_expired: 'Inspection window ended',
  return_requested: 'Buyer requested a return',
  problem_reported: 'Buyer reported a problem',
  review_resolved: 'SaddleUp resolved the review',
  payout_sent: 'Seller payout sent',
  payout_failed: 'Seller payout failed (will retry)',
  refunded: 'Refunded',
  disputed: 'Card dispute opened'
};
