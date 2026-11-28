// Google Merchant Center / Shopping: what we tell Google about each saddle for sale.
// Used by the product feed (/merchant-feed.xml) and the Product structured data on saddle pages.
import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { parcelFor, quoteByZip, shippoConfigured } from '@/lib/shippo';
import { DISCIPLINE_LABELS, TREE_WIDTH_LABELS, type Discipline, type TreeWidth } from '@/lib/types';

/** Seller has this many business days to ship (order-rules DISPATCH_BUSINESS_DAYS). */
export const HANDLING_DAYS = { min: 0, max: 3 };
/** Ground transit we quote (UPS/FedEx ground; USPS ground while that's the fallback). */
export const TRANSIT_DAYS = { min: 2, max: 5 };
/** The 5-day trial: returns accepted within 5 days of delivery. */
export const RETURN_DAYS = 5;

// Shipping varies by distance, so we quote to the East coast, the middle and the West coast and
// use the highest: Google must never show a lower shipping price than checkout charges.
const REFERENCE_ZIPS = ['10001', '64106', '90012'];
const QUOTE_HOURS = 24;

export interface MerchantListing {
  id: string;
  slug: string;
  model: string;
  seat_size: number | string | null;
  discipline: Discipline | null;
  tree_width: TreeWidth | null;
  condition: string | null;
  color: string | null;
  year_manufactured: number | null;
  description: string | null;
  images: string[] | null;
  price_cents: number;
  location_zip: string | null;
  pkg_length_in?: number | null;
  pkg_width_in?: number | null;
  pkg_height_in?: number | null;
  pkg_weight_lb?: number | null;
  brands?: { name?: string | null } | null;
}

export function merchantTitle(l: MerchantListing) {
  const brand = l.brands?.name && l.brands.name !== 'Other' ? `${l.brands.name} ` : '';
  const discipline = l.discipline && l.discipline !== 'all_purpose' ? `${DISCIPLINE_LABELS[l.discipline]} ` : 'All Purpose ';
  const tree = l.tree_width ? `, ${TREE_WIDTH_LABELS[l.tree_width]} Tree` : '';
  const used = l.condition === 'new' ? '' : 'Used ';
  return `${used}${l.seat_size ? `${l.seat_size}" ` : ''}${brand}${l.model} ${discipline}Saddle${tree}`.replace(/\s+/g, ' ').trim().slice(0, 150);
}

/** Cached carrier quotes (no new carrier calls): the highest of the reference quotes, in cents. */
export async function cachedShippingEstimate(listingId: string, priceCents: number): Promise<number | null> {
  const { data } = await createAdminClient()
    .from('shipping_quotes')
    .select('to_zip, amount_cents')
    .eq('listing_id', listingId)
    .in('to_zip', REFERENCE_ZIPS)
    .eq('insured_cents', priceCents)
    .gt('expires_at', new Date().toISOString());
  const best = new Map<string, number>();
  for (const q of data ?? []) best.set(q.to_zip, Math.max(best.get(q.to_zip) ?? 0, q.amount_cents));
  return best.size === REFERENCE_ZIPS.length ? Math.max(...Array.from(best.values())) : null;
}

/** Highest ground quote to the reference ZIPs, fetching (and caching) any that are missing. */
export async function shippingEstimate(l: MerchantListing): Promise<number | null> {
  if (!l.location_zip || !shippoConfigured()) return null;
  const admin = createAdminClient();
  const { data: recent } = await admin
    .from('shipping_quotes')
    .select('to_zip, amount_cents')
    .eq('listing_id', l.id)
    .in('to_zip', REFERENCE_ZIPS)
    .eq('insured_cents', l.price_cents)
    .gt('expires_at', new Date(Date.now() + 3600 * 1000).toISOString());
  const amounts = new Map<string, number>();
  for (const q of recent ?? []) amounts.set(q.to_zip, Math.max(amounts.get(q.to_zip) ?? 0, q.amount_cents));

  const parcel = parcelFor(l);
  for (const zip of REFERENCE_ZIPS.filter((z) => !amounts.has(z))) {
    try {
      const rate = await quoteByZip(l.location_zip, zip, parcel, l.price_cents);
      if (!rate) return null; // no ground service somewhere: leave shipping to the account default
      amounts.set(zip, rate.amountCents);
      // Saved like any quote, so a buyer in that ZIP can check out with it too.
      await admin.from('shipping_quotes').insert({
        listing_id: l.id,
        buyer_id: null,
        to_zip: zip,
        from_zip: l.location_zip,
        amount_cents: rate.amountCents,
        carrier: rate.carrier,
        service_token: rate.serviceToken,
        service_name: rate.serviceName,
        estimated_days: rate.estimatedDays,
        insured_cents: l.price_cents,
        parcel,
        expires_at: new Date(Date.now() + QUOTE_HOURS * 3600 * 1000).toISOString()
      });
    } catch (e) {
      console.error(`Merchant feed: shipping quote failed for listing ${l.id}`, e);
      return null;
    }
  }
  return Math.max(...Array.from(amounts.values()));
}
