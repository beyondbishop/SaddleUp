// Admin status changes for a listing: put it back live, send it back to draft, take it down,
// or (for unclaimed imports) show/hide it before the seller claims it. No server dependencies,
// so the picker in the browser uses the same rules as the API.

export type StatusChoice = 'live' | 'draft' | 'removed' | 'unclaimed_shown' | 'unclaimed_hidden';

export const CHOICE_LABELS: Record<StatusChoice, string> = {
  live: 'Live on the site',
  draft: 'Draft (hidden, back in the review queue)',
  removed: 'Removed (hidden)',
  unclaimed_shown: 'Unclaimed, showing on the site',
  unclaimed_hidden: 'Unclaimed, hidden'
};

type ListingLike = { status: string; seller_id: string | null; show_before_claim?: boolean | null };

/** Where the listing is now, as one of the choices (null when it can't be changed by hand). */
export function currentChoice(l: ListingLike): StatusChoice | null {
  if (l.status === 'active') return 'live';
  if (l.status === 'draft') return 'draft';
  if (l.status === 'removed') return 'removed';
  if (l.status === 'unclaimed') return l.show_before_claim ? 'unclaimed_shown' : 'unclaimed_hidden';
  return null; // sold / pending_sale: tied to an order
}

/**
 * What an admin may switch it to. A saddle with no seller can't go live (nobody to pay), so it
 * stays unclaimed (shown or hidden) or removed; a sold or mid-checkout saddle is left alone.
 */
export function allowedChoices(l: ListingLike): StatusChoice[] {
  if (l.status === 'sold' || l.status === 'pending_sale') return [];
  return l.seller_id ? ['live', 'draft', 'removed'] : ['unclaimed_shown', 'unclaimed_hidden', 'removed'];
}

/** The database change for a choice. */
export function updateFor(choice: StatusChoice): { status: string; show_before_claim?: boolean } {
  switch (choice) {
    case 'live':
      return { status: 'active' };
    case 'draft':
      return { status: 'draft' };
    case 'removed':
      return { status: 'removed' };
    case 'unclaimed_shown':
      return { status: 'unclaimed', show_before_claim: true };
    case 'unclaimed_hidden':
      return { status: 'unclaimed', show_before_claim: false };
  }
}
