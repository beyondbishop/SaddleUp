// Server-only: fair price ranges, cached so each saddle description is priced (and paid for) once.
// - cachedPriceRange(): used by /api/price-range (import check, form price box). Reuses a recent
//   result for the same saddle details instead of asking the AI again.
// - refreshListingPriceRange(): stores the range on a listing for its public saddle page.
//   Skips the work when the saddle details haven't changed since the last check.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { aiPriceRange, type PriceRange, type SaddleDetails } from '@/lib/ai-price-range';
import { isGenericModel } from '@/lib/saddle-catalog';

/** A cached range is reused for this long; prices move, so older checks are redone. */
const CACHE_DAYS = 21;

/**
 * Same saddle -> same key. Leaves out the free-text description and color (they change with every
 * edit but rarely move the price), so small wording fixes don't trigger a new paid check.
 */
export function priceRangeKey(d: SaddleDetails): string {
  const norm = (v: unknown) => (v == null || v === '' ? '' : String(v).trim().toLowerCase().replace(/\s+/g, ' '));
  return [d.brand, d.model, d.discipline, d.seat_size, d.tree_width, d.condition, d.year_manufactured, d.panel_type, d.panel_flocking]
    .map(norm)
    .join('|');
}

export async function cachedPriceRange(details: SaddleDetails): Promise<PriceRange & { key: string; cached: boolean }> {
  const key = priceRangeKey(details);
  const admin = createAdminClient();
  const since = new Date(Date.now() - CACHE_DAYS * 864e5).toISOString();
  const { data: hit } = await admin.from('price_range_cache').select('*').eq('key', key).gte('created_at', since).maybeSingle();
  if (hit) {
    return {
      low: hit.low,
      typical: hit.typical,
      high: hit.high,
      reasoning: hit.reasoning ?? '',
      confidence: (hit.confidence as PriceRange['confidence']) ?? 'medium',
      sources: hit.sources ?? [],
      searched: !!hit.searched,
      key,
      cached: true
    };
  }
  const range = await aiPriceRange(details);
  const { error } = await admin.from('price_range_cache').upsert({
    key,
    low: range.low,
    typical: range.typical,
    high: range.high,
    confidence: range.confidence,
    reasoning: range.reasoning,
    sources: range.sources,
    searched: range.searched,
    created_at: new Date().toISOString()
  });
  if (error) console.error('Could not cache price range', error.message);
  return { ...range, key, cached: false };
}

const LISTING_FIELDS =
  'id, model, discipline, seat_size, tree_width, condition, year_manufactured, panel_type, panel_flocking, color, description, price_range_key, price_range_at, brands(name)';

function detailsFromListing(l: any): SaddleDetails {
  return {
    brand: l.brands?.name && l.brands.name !== 'Other' ? l.brands.name : null,
    // "Close Contact" etc. just means the model isn't known.
    model: l.model && !isGenericModel(l.model, l.discipline) ? l.model : null,
    discipline: l.discipline ?? null,
    seat_size: l.seat_size ?? null,
    tree_width: l.tree_width ?? null,
    condition: l.condition ?? null,
    year_manufactured: l.year_manufactured ?? null,
    panel_type: l.panel_type ?? null,
    panel_flocking: l.panel_flocking ?? null,
    color: l.color ?? null,
    description: l.description ?? null
  };
}

function isFresh(l: { price_range_key: string | null; price_range_at: string | null }, key: string) {
  return l.price_range_key === key && !!l.price_range_at && Date.now() - new Date(l.price_range_at).getTime() < CACHE_DAYS * 864e5;
}

/** Work out (or reuse) the listing's fair range and save it on the listing. Never throws. */
export async function refreshListingPriceRange(listingId: string): Promise<{ low: number; typical: number; high: number } | null> {
  try {
    const admin = createAdminClient();
    const { data: listing } = await admin.from('listings').select(LISTING_FIELDS).eq('id', listingId).maybeSingle();
    if (!listing) return null;
    const details = detailsFromListing(listing);
    if (!details.brand && !details.model) return null;
    const key = priceRangeKey(details);
    if (isFresh(listing as any, key)) {
      const { data: row } = await admin
        .from('listings')
        .select('price_range_low, price_range_typical, price_range_high')
        .eq('id', listingId)
        .single();
      if (row?.price_range_typical) return { low: row.price_range_low, typical: row.price_range_typical, high: row.price_range_high };
    }
    const range = await cachedPriceRange(details);
    await admin
      .from('listings')
      .update({
        price_range_low: range.low,
        price_range_typical: range.typical,
        price_range_high: range.high,
        price_range_key: key,
        price_range_at: new Date().toISOString()
      })
      .eq('id', listingId);
    return { low: range.low, typical: range.typical, high: range.high };
  } catch (e) {
    console.error('Listing price range failed', listingId, e);
    return null;
  }
}

/** Daily backstop: fill in or update ranges the save-time check missed. Returns how many it did. */
export async function refreshStalePriceRanges(limit = 8): Promise<number> {
  const admin = createAdminClient();
  const { data: listings } = await admin
    .from('listings')
    .select(LISTING_FIELDS)
    .in('status', ['active', 'unclaimed', 'pending_sale'])
    .order('created_at', { ascending: false })
    .limit(300);
  const stale = (listings ?? []).filter((l: any) => {
    const d = detailsFromListing(l);
    return (d.brand || d.model) && !isFresh(l, priceRangeKey(d));
  });
  let done = 0;
  for (const l of stale.slice(0, limit)) {
    if (await refreshListingPriceRange((l as any).id)) done++;
  }
  return done;
}
