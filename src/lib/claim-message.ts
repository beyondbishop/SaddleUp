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
 * The message an importer pastes into Messenger. The claim-or-remove link comes right after the
 * greeting, so the seller can act (or take it down themselves) without reading on. Then who we
 * are, why SaddleUp helps, what we've done for them and what claiming gets them, the fee, and
 * last, a few observations to help it sell (price, spelling, any choices we made on their
 * listing). Honest throughout: buyer messages are passed on, the fee is the real one, and the
 * price note doesn't claim SaddleUp sales data.
 *
 * `saddle` reads like `17.5" Pessoa A/O`.
 */
export function claimMessage(sellerName: string | null | undefined, saddle: string, claimUrl: string, tips: ClaimTips = {}) {
  const first = (sellerName ?? '').trim().split(/\s+/)[0];
  const fix = spelling(tips);
  const price = priceTip(tips);
  const choices = (tips.listingNotes ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 3);

  const notes = [
    price,
    fix ? `Spelling: "${fix.wrong}" is spelled "${fix.right}". Buyers search by brand, so fixing it on Facebook helps them find you.` : null,
    ...choices
  ].filter((n): n is string => !!n);

  return [
    `Hi${first ? ` ${first}` : ''}!\nI came across your ${saddle} and wanted to help you find a buyer!`,
    `To claim your free listing or remove it, click here:\n${claimUrl}`,
    tips.fromFounder
      ? `I'm an equestrian and recently launched SaddleUp.me, a marketplace I built after experiencing firsthand how frustrating and expensive selling a used saddle can be.`
      : `SaddleUp.me is a new saddle marketplace, built by an equestrian after experiencing firsthand how frustrating and expensive selling a used saddle can be.`,
    `One challenge with selling on Facebook is that your listing is largely limited to Facebook users. SaddleUp is designed to help your saddle get discovered through Google and AI searches, reaching riders looking for that exact model.`,
    `To make it easy, I created a free listing for your saddle using your existing ${tips.hasPhotos ? 'photos and description' : 'description'}${
      fix ? ' (with the spelling fixed)' : ''
    }. It's already on SaddleUp, and if someone inquires, I'll pass their message along to you.`,
    `Once you claim your listing, you can edit it, communicate directly with buyers, and receive secure payments.`,
    `We're currently in beta, so listing is completely free, and the total fee is only ${SELLER_FEE_PERCENT}% if your saddle sells, including credit card processing.`,
    notes.length
      ? `${notes.length === 1 ? 'One observation' : 'A couple of observations'} that may help your saddle sell:\n${notes.map((n) => `• ${n}`).join('\n')}`
      : null,
    `I hope this helps connect your saddle with its next rider!${tips.fromFounder ? '\nDanielle Bishop\nFounder, SaddleUp' : ''}`
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
