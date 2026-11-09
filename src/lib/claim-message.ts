import { SELLER_FEE_PERCENT } from './fees';

/** Personal tips for the seller, found while importing their post. All optional. */
export interface ClaimTips {
  /** Searchable names misspelled in their post, as "wrong → right". */
  spellingFixes?: string[];
  /** Their asking price, in dollars. */
  askingPrice?: number | null;
  /** AI estimate from current listings online (not SaddleUp sales data). */
  priceRange?: { low: number; typical: number; high: number } | null;
  /** Whether the listing already has their photos. */
  hasPhotos?: boolean;
  /** The saddle's discipline, to show what buyers would search for. */
  discipline?: string | null;
  /** Sent by SaddleUp's founder (an admin), so the "why I built it" line is in the first person. */
  fromFounder?: boolean;
  /**
   * Judgment calls made on their listing that they may want to check, in plain words, e.g.
   * "We marked your saddle Medium-narrow because you listed it as 27 cm and Stubben's standard (Medium) is 28 cm."
   */
  listingNotes?: string[];
  /** Seat size or tree width was missing or uncertain, so point them to the measuring guide. */
  measureGuide?: boolean;
  /** The listing was saved without a tree width, so ask for it and link the tree-width section. */
  treeMissing?: boolean;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;


function spelling(t: ClaimTips): { wrong: string; right: string } | null {
  const [wrong, right] = (t.spellingFixes?.[0] ?? '').split(/\s*(?:→|->)\s*/);
  return wrong && right ? { wrong, right } : null;
}

/** Where their price sits against the range we found for comparable saddles. */
function priceTip(t: ClaimTips): string | null {
  const r = t.priceRange;
  if (!r) return null;
  const range = `${usd(r.low)}–${usd(r.high)} range we found for comparable saddles`;
  if (!t.askingPrice) return `Pricing: Comparable saddles are listed for about ${usd(r.low)}–${usd(r.high)} right now.`;
  const ask = `Your ${usd(t.askingPrice)} asking price`;
  if (t.askingPrice > r.high) return `Pricing: ${ask} is above the ${range}, so it may take longer to sell. Something nearer ${usd(r.high)} would likely sell faster.`;
  if (t.askingPrice > r.typical) return `Pricing: ${ask} is toward the higher end of the ${range}.`;
  if (t.askingPrice >= r.low) return `Pricing: ${ask} is right in line with the ${range}.`;
  return `Pricing: ${ask} is below the ${range}, so it's a great deal for buyers.`;
}

/**
 * The observations we made while importing (price, spelling, judgment calls, measuring help).
 * No longer part of the Messenger message, which is kept short; meant for the seller once
 * they've claimed and are editing the listing.
 */
export function claimNotes(tips: ClaimTips = {}): string[] {
  const fix = spelling(tips);
  const choices = (tips.listingNotes ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 3);
  return [
    priceTip(tips),
    fix ? `Spelling: "${fix.wrong}" is spelled "${fix.right}". Buyers search by brand, so fixing it on Facebook helps them find you.` : null,
    ...choices,
    tips.treeMissing
      ? `Tree width: Your post didn't mention the tree width, so I left it blank. Riders filter by it, so adding it will help your saddle reach the right buyers. This quick guide shows how to find it: ${siteUrl()}/guides/how-to-measure-a-saddle#tree`
      : tips.measureGuide
        ? `Measurements: Buyers look for seat size and tree width first. If you're not sure of yours, this quick guide shows exactly where to measure: ${siteUrl()}/guides/how-to-measure-a-saddle`
        : null
  ].filter((n): n is string => !!n);
}

/**
 * The short message an importer pastes into Messenger: what we did, that there's nothing to
 * re-enter, what claiming gets them, the fee, and the claim-or-remove link. Plain text, since
 * Messenger doesn't render bold. The longer observations live in `claimNotes`.
 *
 * `saddle` reads like `17.5" Pessoa A/O`.
 */
export function claimMessage(sellerName: string | null | undefined, saddle: string, claimUrl: string, tips: ClaimTips = {}) {
  const first = (sellerName ?? '').trim().split(/\s+/)[0];
  return [
    `Hi${first ? ` ${first}` : ''}! I came across your ${saddle} and added it to SaddleUp, ${
      tips.fromFounder ? 'a new marketplace I created' : 'a new marketplace created by an equestrian'
    } to help equestrians sell their saddles.`,
    `Your ${tips.hasPhotos ? 'photos and description are' : 'description is'} already there, so there's nothing to re-enter!`,
    `Claim your free listing to take control of it, edit your price, and connect directly with buyers.`,
    `SaddleUp is designed to help riders discover your saddle through Google and AI search. It's free to list, with a ${SELLER_FEE_PERCENT}% fee only if it sells.`,
    `Claim your listing or remove it here:\n${claimUrl}`,
    tips.fromFounder ? 'Danielle\nFounder, SaddleUp' : null
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The public site address (never localhost, since messages go to real people). */
function siteUrl() {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') ? 'https://saddleup.me' : process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me';
  return site.replace(/\/$/, '');
}

export function claimUrlFor(token: string) {
  return `${siteUrl()}/claim/${token}`;
}
