// Pure helpers for turning an eBay Browse API item into SaddleUp listing fields.
// No Next.js / Supabase imports here so this file can be unit-tested directly.

import type { Discipline, TreeWidth } from '../types';

export interface EbayItem {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  shortDescription?: string;
  description?: string;
  price?: { value?: string; currency?: string };
  condition?: string;
  image?: { imageUrl?: string };
  additionalImages?: { imageUrl?: string }[];
  localizedAspects?: { name?: string; value?: string }[];
  itemLocation?: { city?: string; stateOrProvince?: string; country?: string };
  seller?: { username?: string };
  itemWebUrl?: string;
}

export interface ListingPrefill {
  brand_id: number | null;
  model: string;
  discipline: Discipline | null;
  seat_size: number | null;
  tree_width: TreeWidth | null;
  condition: string | null;
  color: string | null;
  year_manufactured: number | null;
  panel_type: string | null;
  price: number | null;
  description: string;
  location_city: string | null;
  location_state: string | null;
  trial_policy?: import('../types').TrialPolicy | null;
  location_zip?: string | null;
  panel_flocking?: import('../types').PanelFlocking | null;
  tree_width_cm?: number | null;
  panel_length_cm?: number | null;
}

export interface EbaySource {
  item_id: string;
  url: string;
  seller_username: string | null;
  title: string;
}

// ---------- URL parsing ----------

const EBAY_HOST = /(^|\.)ebay\.(com|ca|co\.uk|com\.au|de|fr|it|es|ie|at|ch|nl|be|pl)$/i;

/** Pulls the numeric legacy item id out of any common eBay listing URL, or a bare id. */
export function parseEbayItemId(input: string): string | null {
  const raw = input.trim();
  if (/^\d{9,15}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!EBAY_HOST.test(url.hostname)) return null;

  const fromPath = url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:[/?]|$)/);
  if (fromPath) return fromPath[1];

  const fromQuery = url.searchParams.get('item') ?? url.searchParams.get('itm');
  if (fromQuery && /^\d{9,15}$/.test(fromQuery)) return fromQuery;

  return null;
}

/** eBay app "share" links (ebay.us/abc123) redirect to the real listing URL. */
export function isEbayShortLink(input: string): boolean {
  try {
    const url = new URL(input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`);
    return url.hostname.toLowerCase() === 'ebay.us';
  } catch {
    return false;
  }
}

// ---------- field mapping ----------

function aspect(item: EbayItem, ...names: string[]): string | null {
  const wanted = names.map((n) => n.toLowerCase());
  const found = item.localizedAspects?.find((a) => a.name && wanted.includes(a.name.toLowerCase()));
  const v = found?.value?.trim();
  return v && !/^(unbranded|does not apply|n\/a|unknown|see description)$/i.test(v) ? v : null;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Matches an eBay brand string (or the title) against SaddleUp's brand list. Longest name wins. */
export function matchBrand(
  brands: { id: number; name: string }[],
  brandAspect: string | null,
  title: string
): { id: number; name: string } | null {
  const sorted = [...brands].filter((b) => norm(b.name) !== 'other').sort((a, b) => b.name.length - a.name.length);
  if (brandAspect) {
    const a = norm(brandAspect);
    const exact = sorted.find((b) => norm(b.name) === a);
    if (exact) return exact;
    const partial = sorted.find((b) => a.includes(norm(b.name)) || norm(b.name).includes(a));
    if (partial) return partial;
  }
  const t = ` ${norm(title)} `;
  return sorted.find((b) => t.includes(` ${norm(b.name)} `)) ?? null;
}

export function parseSeatSize(...sources: (string | null | undefined)[]): number | null {
  for (const s of sources) {
    if (!s) continue;
    const fraction = s.replace(/(\d{2})\s*1\/2/, '$1.5').replace(/½/g, '.5');
    const m =
      fraction.match(/\b(1[4-9](?:\.5|\.0)?)\s*(?:"|”|''|in\b|inch|inches|\s*seat)/i) ??
      fraction.match(/^\s*(1[4-9](?:\.5)?)\s*$/);
    if (m) {
      const n = Number(m[1]);
      if (n >= 14 && n <= 19.5) return n;
    }
  }
  return null;
}

export function parseTreeWidth(...sources: (string | null | undefined)[]): TreeWidth | null {
  for (const s of sources) {
    if (!s) continue;
    const t = s.toLowerCase();
    if (/adjustable|interchangeable|changeable|easy.?change|cair|gullet system/.test(t)) return 'adjustable';
    if (/(x|extra)[\s-]*wide|\bxw\b/.test(t)) return 'x_wide';
    if (/(x|extra)[\s-]*narrow|\bxn\b/.test(t)) return 'x_narrow';
    if (/medium[\s/-]*wide|\bmw\b|med[\s/-]*wide/.test(t)) return 'medium_wide';
    if (/medium[\s/-]*narrow|\bmn\b|med[\s/-]*narrow/.test(t)) return 'medium_narrow';
    if (/\bwide\b/.test(t)) return 'wide';
    if (/\bnarrow\b/.test(t)) return 'narrow';
    if (/\bmedium\b|\bmed\b|regular tree|standard tree/.test(t)) return 'medium';
  }
  return null;
}

export function parseDiscipline(...sources: (string | null | undefined)[]): Discipline | null {
  for (const s of sources) {
    if (!s) continue;
    const t = s.toLowerCase();
    if (/endurance|trail|treeless/.test(t)) return 'endurance';
    if (/western|barrel|roping|reining|ranch|cutting|pleasure|roper/.test(t)) return 'western';
    if (/dressage/.test(t)) return 'dressage';
    if (/eventing|event saddle|cross[\s-]*country|\bxc\b/.test(t)) return 'eventing';
    if (/pony|child|kids?\b|youth/.test(t)) return 'pony_child';
    if (/jump|hunter|close[\s-]*contact|\bcc\b|monoflap/.test(t)) return 'hunter_jumper';
    if (/all[\s-]*purpose|general purpose|\bgp\b|\bap\b/.test(t)) return 'all_purpose';
  }
  return null;
}

function mapCondition(c: string | undefined): string | null {
  if (!c) return null;
  const t = c.toLowerCase();
  if (t.startsWith('new')) return 'new';
  if (/excellent|like new|open box/.test(t)) return 'excellent';
  if (/very good|good/.test(t)) return 'good';
  if (/acceptable|fair|parts/.test(t)) return 'fair';
  return c;
}

/** Turns eBay's HTML description into plain text paragraphs. */
export function htmlToText(html: string | undefined, max = 4000): string {
  if (!html) return '';
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Guesses the model name: eBay's Model aspect, else the title minus brand, seat size and filler words. */
function guessModel(item: EbayItem, brandName: string | null): string {
  const fromAspect = aspect(item, 'Model', 'Product Line');
  if (fromAspect) return fromAspect.slice(0, 80);
  let t = item.title ?? '';
  if (brandName) t = t.replace(new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
  t = t
    .replace(/\b1[4-9](?:\.5)?\s*(?:"|”|''|in\b|inch(?:es)?)/gi, '')
    .replace(/\b(saddle|english|used|pre-?owned|great|excellent|condition|nice|beautiful|leather|tree|seat|with)\b/gi, '')
    .replace(/\bw\/(?=\s|$)/gi, '')
    .replace(/\b(x|extra)?[\s-]*(medium[\s/-]*)?(wide|narrow)\b|\b(medium|med|mw|mn|xw|xn|adjustable)\b/gi, '')
    .replace(/\b(dressage|jump(ing|er)?|hunter|close[\s-]*contact|all[\s-]*purpose|monoflap|eventing|western|cc|gp|ap)\b/gi, '')
    .replace(/[|,*~!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.slice(0, 80);
}

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY'
};

function stateCode(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^[A-Z]{2}$/i.test(t)) return t.toUpperCase();
  return US_STATES[t.toLowerCase()] ?? t;
}

/** All image URLs on the item, main photo first, deduplicated, eBay's own image host only. */
export function itemImageUrls(item: EbayItem, limit = 12): string[] {
  const urls = [item.image?.imageUrl, ...(item.additionalImages ?? []).map((i) => i.imageUrl)].filter(
    (u): u is string => !!u && isEbayImageUrl(u)
  );
  return Array.from(new Set(urls)).slice(0, limit);
}

export function isEbayImageUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && /(^|\.)ebayimg\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function mapEbayItem(item: EbayItem, brands: { id: number; name: string }[]): ListingPrefill {
  const title = item.title ?? '';
  const brand = matchBrand(brands, aspect(item, 'Brand'), title);
  const seat = aspect(item, 'Seat Size', 'Saddle Seat Size', 'Size');
  const tree = aspect(item, 'Tree Width', 'Tree Size', 'Gullet Width', 'Gullet Size', 'Tree');
  const type = aspect(item, 'Discipline', 'Riding Style', 'Saddle Type', 'Type', 'Style', 'Sport');
  const description = htmlToText(item.description) || item.shortDescription || '';
  const price = item.price?.currency === 'USD' && item.price.value ? Math.round(Number(item.price.value)) : null;
  const year = Number(aspect(item, 'Year Manufactured', 'Year'));

  return {
    brand_id: brand?.id ?? null,
    model: guessModel(item, brand?.name ?? aspect(item, 'Brand')),
    discipline: parseDiscipline(type, title),
    seat_size: parseSeatSize(seat, title),
    tree_width: parseTreeWidth(tree, title),
    condition: mapCondition(item.condition),
    color: aspect(item, 'Color', 'Colour'),
    year_manufactured: year >= 1900 && year <= new Date().getFullYear() ? year : null,
    panel_type: aspect(item, 'Panel Type', 'Flap Type'),
    price: price && price > 0 ? price : null,
    description,
    location_city: item.itemLocation?.city ?? null,
    location_state: item.itemLocation?.country === 'US' ? stateCode(item.itemLocation?.stateOrProvince) : null
  };
}
