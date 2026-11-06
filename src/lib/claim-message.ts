import { SELLER_FEE_PERCENT } from './fees';

/** Personal tips for the seller, found while importing their post. All optional. */
export interface ClaimTips {
  /** Searchable names misspelled in their post, as "wrong → right". */
  spellingFixes?: string[];
  /** Their asking price, in dollars. */
  askingPrice?: number | null;
  /** AI estimate from current listings online (not SaddleUp sales data). */
  priceRange?: { low: number; typical: number; high: number } | null;
  /** Whether the hidden listing already has their photos. */
  hasPhotos?: boolean;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Suggest a price only when theirs is clearly above what similar saddles go for. */
function priceTip(t: ClaimTips): string | null {
  const r = t.priceRange;
  if (!r || !t.askingPrice || t.askingPrice <= r.typical * 1.1) return null;
  return (
    `Similar saddles listed right now go for about ${usd(r.low)}–${usd(r.high)}, ` +
    `so asking around ${usd(r.typical)} would likely help it sell faster.`
  );
}

function spellingTip(t: ClaimTips): string | null {
  const fix = t.spellingFixes?.[0];
  if (!fix) return null;
  const [wrong, right] = fix.split(/\s*(?:→|->)\s*/);
  return right
    ? `Your post says "${wrong}" - it's spelled "${right}", so riders searching for ${right} on Facebook may not be finding it.`
    : null;
}

/**
 * The message an importer pastes into Messenger. Honest: the listing isn't public until
 * claimed, the fee is the real one, and price advice says where it comes from.
 */
export function claimMessage(sellerName: string | null | undefined, saddle: string, claimUrl: string, tips: ClaimTips = {}) {
  const first = (sellerName ?? '').trim().split(/\s+/)[0];
  const noticed = [spellingTip(tips), priceTip(tips)].filter((t): t is string => !!t);

  return [
    `Hi${first ? ` ${first}` : ''}! I saw your ${saddle} for sale. I'm with SaddleUp, a new saddle marketplace where riders shop by seat size and tree width, so buyers know it will fit before they buy.`,
    `I've set up a free listing for yours${tips.hasPhotos ? ' with your photos and details' : ''}, ready to go live: ${claimUrl}`,
    `We're in beta, so it's just a ${SELLER_FEE_PERCENT}% fee when it sells - nothing to list and nothing if it doesn't sell. We handle the payment and shipping label, and buyers get a 5-day inspection window, so they can buy with confidence.`,
    ...(noticed.length
      ? [`${noticed.length === 1 ? 'One thing I noticed' : 'A couple of things I noticed'} that might help:\n${noticed.map((n) => `• ${n}`).join('\n')}`]
      : []),
    `If you'd rather not, just ignore this and it never goes public.`
  ].join('\n\n');
}

export function claimUrlFor(token: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') ? 'https://saddleup.me' : process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me';
  return `${site.replace(/\/$/, '')}/claim/${token}`;
}
