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

/** How riders describe each discipline when they search. */
const STYLE: Record<string, string> = {
  hunter_jumper: 'close contact',
  dressage: 'dressage',
  all_purpose: 'all purpose',
  eventing: 'eventing',
  pony_child: 'pony',
  western: 'western',
  endurance: 'endurance'
};

function spelling(t: ClaimTips): { wrong: string; right: string } | null {
  const [wrong, right] = (t.spellingFixes?.[0] ?? '').split(/\s*(?:→|->)\s*/);
  return wrong && right ? { wrong, right } : null;
}

/**
 * The price range for similar saddles, with what it means for their price: above the range, a
 * gentle nudge toward the top of it; in the upper half, "on the higher end"; otherwise reassurance.
 */
function priceTip(t: ClaimTips): string | null {
  const r = t.priceRange;
  if (!r) return null;
  const range = `${usd(r.low)}–${usd(r.high)}`;
  if (!t.askingPrice) return `Similar saddles are listed for about ${range} right now.`;
  const ask = usd(t.askingPrice);
  if (t.askingPrice > r.high) {
    return `Your price of ${ask} is above similar saddles (about ${range}), so it may sit longer; something nearer ${usd(r.high)} would likely sell faster.`;
  }
  if (t.askingPrice > r.typical) return `Your price of ${ask} is on the higher end of similar saddles (about ${range}).`;
  if (t.askingPrice >= r.low) return `Your price of ${ask} is right in line with similar saddles (about ${range}).`;
  return `Your price of ${ask} is below similar saddles (about ${range}), so it's a great deal for buyers.`;
}

/**
 * The message an importer pastes into Messenger. What's in it for them comes first (a free
 * listing that buyers can find, and the claim link), then the details, the sign-off, and finally
 * a few notes to help it sell: spelling, how the price compares, and any choices we made on their
 * listing they may want to check. Honest throughout: the listing is on the site but kept out of
 * Google until claimed, buyer messages are passed on, the fee is the real one, and the price
 * note doesn't claim SaddleUp sales data.
 *
 * `saddle` reads like `17.5" Pessoa A/O`.
 */
export function claimMessage(sellerName: string | null | undefined, saddle: string, claimUrl: string, tips: ClaimTips = {}) {
  const first = (sellerName ?? '').trim().split(/\s+/)[0];
  const fix = spelling(tips);
  const price = priceTip(tips);
  const style = tips.discipline ? STYLE[tips.discipline] : null;
  const choices = (tips.listingNotes ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 3);

  // What a buyer would type: seat + brand (+ style), e.g. "17.5 Pessoa close contact".
  const seatBrand = saddle.replace(/"/g, '').split(' ').slice(0, 2).join(' ');
  const searchFor = `${seatBrand}${style ? ` ${style}` : ''}`;

  const notes = [
    fix ? `"${fix.wrong}" is spelled "${fix.right}". Buyers search by brand, so fixing it on Facebook helps them find you.` : null,
    price,
    ...choices
  ].filter((n): n is string => !!n);

  return [
    `Hi${first ? ` ${first}` : ''}! I came across your ${saddle} saddle.`,
    `Facebook posts only show up on Facebook. I made you a free SaddleUp listing${fix ? ' (spelling fixed)' : ''}${
      tips.hasPhotos ? ' with your photos' : ''
    }. It's on the site now, and if a buyer asks about it I'll pass their message straight to you. Claim it to answer buyers yourself and get paid through SaddleUp. Once it's claimed, it can also show up on Google and AI search when riders look for "${searchFor}":\n${claimUrl}`,
    `We're in beta: free to list, and just ${SELLER_FEE_PERCENT}% if it sells. That includes the ~3% card processing fee, so there's nothing else to pay. If you ever want to ship it, we handle the payment and shipping label.`,
    tips.fromFounder
      ? `I've been through the pain of trying to sell a saddle myself, so I built SaddleUp to make it easy. Our story: ${siteUrl()}/about`
      : `SaddleUp was started by a horse mom who's been through the pain of trying to sell a saddle, to make it easy. Her story: ${siteUrl()}/about`,
    `No pressure. If you'd rather it not be on SaddleUp, just tell me and I'll take it down.`,
    tips.fromFounder ? `Danielle\nFounder, SaddleUp` : null,
    notes.length
      ? `${notes.length === 1 ? 'A quick note' : 'A few quick notes'} to help it sell, whether or not you use SaddleUp:\n${notes.map((n) => `• ${n}`).join('\n')}${
          choices.length ? '\nIf you claim your listing, please edit anything as needed.' : ''
        }`
      : null
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
