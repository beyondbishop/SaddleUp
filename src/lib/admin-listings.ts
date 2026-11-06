// Shared labels for admin listing views.

export const LISTING_STATUSES = ['draft', 'unclaimed', 'active', 'pending_sale', 'sold', 'removed'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Awaiting review',
  unclaimed: 'Unclaimed',
  active: 'Live',
  pending_sale: 'Sale pending',
  sold: 'Sold',
  removed: 'Removed'
};

export const STATUS_STYLES: Record<ListingStatus, string> = {
  draft: 'bg-amber-100 text-amber-900',
  unclaimed: 'bg-saddle-sand text-saddle-muted',
  active: 'bg-saddle-green-mist text-saddle-green-dark',
  pending_sale: 'bg-blue-100 text-blue-900',
  sold: 'bg-saddle-brown text-saddle-cream',
  removed: 'bg-gray-200 text-gray-600'
};

export const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

export const saddleTitle = (l: { seat_size?: number | null; model?: string | null; brands?: { name?: string } | null }) =>
  `${l.seat_size ?? ''}" ${l.brands?.name ?? ''} ${l.model ?? ''}`.replace(/\s+/g, ' ').trim();
