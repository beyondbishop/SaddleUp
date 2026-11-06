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
  /** The saddle's discipline, to show what buyers would search for. */
  discipline?: string | null;
  /** Sent by SaddleUp's founder (an admin), so the "why I built it" line is in the first person. */
  fromFounder?: boolean;
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

/** Suggest a price only when theirs is clearly above what similar saddles go for. */
function priceTip(t: ClaimTips): string | null {
  const r = t.priceRange;
  if (!r || !t.askingPrice || t.askingPrice <= r.typical * 1.1) return null;
  return `Similar saddles are selling for around ${usd(r.typical)}. At ${usd(t.askingPrice)} it may sit longer.`;
}

/**
 * The message an importer pastes into Messenger. Short and useful even if the seller never
 * claims: tips first, then the free listing. Honest throughout: the listing isn't public until
 * claimed, the fee is the real one, and the price tip doesn't claim SaddleUp sales data.
 *
 * `saddle` reads like `17.5" Pessoa A/O`.
 */
export function claimMessage(sellerName: string | null | undefined, saddle: string, claimUrl: string, tips: ClaimTips = {}) {
  const first = (sellerName ?? '').trim().split(/\s+/)[0];
  const fix = spelling(tips);
  const price = priceTip(tips);
  const style = tips.discipline ? STYLE[tips.discipline] : null;

  // What a buyer would type: seat + brand (+ style), e.g. "17.5 Pessoa close contact".
  const seatBrand = saddle.replace(/"/g, '').split(' ').slice(0, 2).join(' ');
  const searchFor = `${seatBrand}${style ? ` ${style}` : ''}`;

  const tipLines = [
    fix ? `• "${fix.wrong}" is spelled "${fix.right}". Buyers search by brand, so fixing it on Facebook helps them find you.` : null,
    price ? `• ${price}` : null
  ].filter(Boolean);

  return [
    `Hi${first ? ` ${first}` : ''}! I came across your ${saddle} saddle.`,
    tipLines.length
      ? `${tipLines.length === 1 ? 'A quick tip' : 'Two quick tips'} to help it sell, whether or not you use SaddleUp:\n${tipLines.join('\n')}`
      : null,
    tips.fromFounder
      ? `I've been through the pain of trying to sell a saddle myself, so I built SaddleUp to make it easy. We're a small family, not a big company: ${siteUrl()}/about`
      : `SaddleUp was started by a horse mom who's been through the pain of trying to sell a saddle, to make it easy. Her story: ${siteUrl()}/about`,
    `Facebook posts only show up on Facebook. I made you a free SaddleUp listing${fix ? ' (spelling fixed)' : ''}${
      tips.hasPhotos ? ' with your photos' : ''
    }. We're new, so there aren't many listings yet, but once you claim it, yours can show up on Google and AI search when riders look for "${searchFor}":\n${claimUrl}`,
    `We're in beta: free to list, and just ${SELLER_FEE_PERCENT}% if it sells. That includes the ~3% card processing fee, so there's nothing else to pay. If you ever want to ship it, we handle the payment and shipping label.`,
    `No pressure. If you don't claim it, it never goes public.`
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
