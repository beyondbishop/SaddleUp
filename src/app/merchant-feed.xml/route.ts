// GET /merchant-feed.xml — product feed for Google Merchant Center (free listings and Shopping ads).
// Merchant Center fetches it on a schedule. Only saddles a shopper can buy right now are listed
// (status active); unclaimed saddles have no checkout, so they're left out. Sold or removed
// saddles drop off on the next fetch.
import { createAdminClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/seo';
import { DISCIPLINE_LABELS } from '@/lib/types';
import { HANDLING_DAYS, merchantTitle, shippingEstimate, type MerchantListing } from '@/lib/merchant';

// Built on request (never during deploys); the CDN keeps a copy for an hour (Cache-Control below).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const tag = (name: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '' : `<${name}>${esc(String(value))}</${name}>`;
const money = (cents: number) => `${(cents / 100).toFixed(2)} USD`;

/** Run `fn` over `items` a few at a time (keeps carrier quote calls polite). */
async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

export async function GET() {
  const { data } = await createAdminClient()
    .from('listings')
    .select('id, slug, model, seat_size, discipline, tree_width, condition, color, year_manufactured, description, images, price_cents, location_zip, pkg_length_in, pkg_width_in, pkg_height_in, pkg_weight_lb, brands(name)')
    .eq('status', 'active')
    .order('updated_at', { ascending: false });
  const listings = ((data ?? []) as unknown as MerchantListing[]).filter((l) => l.images?.length && l.price_cents > 0);
  const shipping = await pool(listings, 3, (l) => shippingEstimate(l));

  const items = listings.map((l, i) => {
    const images = (l.images ?? []).filter((u) => /^https:\/\//.test(u));
    const description =
      (l.description?.trim() ||
        `${merchantTitle(l)}. Listed on SaddleUp with insured, signature-required shipping and a 5-day trial.`).slice(0, 5000);
    const ship = shipping[i];
    return [
      '<item>',
      tag('g:id', l.id),
      tag('g:title', merchantTitle(l)),
      tag('g:description', description),
      tag('g:link', `${SITE_URL}/saddles/${l.slug}`),
      tag('g:image_link', images[0]),
      ...images.slice(1, 11).map((u) => tag('g:additional_image_link', u)),
      tag('g:availability', 'in_stock'),
      tag('g:price', money(l.price_cents)),
      tag('g:condition', l.condition === 'new' ? 'new' : 'used'),
      // "Other" means the seller's brand isn't in our list (it's usually in the model name): no brand.
      tag('g:brand', l.brands?.name && l.brands.name !== 'Other' ? l.brands.name : null),
      tag('g:identifier_exists', 'no'),
      tag('g:product_type', `Saddles > ${l.discipline ? DISCIPLINE_LABELS[l.discipline] : 'Saddles'}`),
      tag('g:color', l.color?.trim()),
      tag('g:size', l.seat_size ? `${l.seat_size} in seat` : null),
      ship !== null
        ? `<g:shipping>${tag('g:country', 'US')}${tag('g:service', 'Ground, signature required, fully insured')}${tag('g:price', money(ship))}</g:shipping>`
        : '',
      tag('g:min_handling_time', HANDLING_DAYS.min),
      tag('g:max_handling_time', HANDLING_DAYS.max),
      '</item>'
    ]
      .filter(Boolean)
      .join('');
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>SaddleUp used saddles</title>
<link>${SITE_URL}</link>
<description>Used close contact, dressage and eventing saddles for sale on SaddleUp</description>
${items.join('\n')}
</channel>
</rss>
`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }
  });
}
