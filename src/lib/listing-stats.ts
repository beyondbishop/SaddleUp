// Server-only: views, visitors, top traffic source, saves and message threads per listing over a
// period, for the stats overview pages (/admin/stats for every saddle, /dashboard/stats for a
// seller's own). Reads with the service key and only ever returns totals, never who.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { VIEW_SOURCE_LABELS, type ViewSource } from '@/lib/view-source';

export const STAT_RANGES = [7, 30, 90] as const;
export type StatRange = (typeof STAT_RANGES)[number];

export const parseRange = (v: unknown): StatRange => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return (STAT_RANGES as readonly number[]).includes(n) ? (n as StatRange) : 30;
};

export type ListingStats = {
  views: number;
  visitors: number;
  /** Where most views came from, with its share of this listing's views (0–1). */
  topSource: { label: string; share: number } | null;
  /** Buyers who saved it to a list in the period (once per buyer, however many lists). */
  saves: number;
  /** New message threads about it in the period. */
  messages: number;
};

export type StatsResult = {
  byListing: Map<string, ListingStats>;
  totals: { views: number; visitors: number; saves: number; messages: number };
};

const PAGE = 1000; // Supabase returns at most 1,000 rows per request, so read in pages.
const MAX_ROWS = 200_000;

export async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error || !data) break; // e.g. a table not created yet: show what we have
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/**
 * Stats for the given listings over the last `days` days. Pass 'all' (admins) to read every
 * listing without a long id filter.
 */
export async function loadListingStats(listingIds: string[] | 'all', days: StatRange): Promise<StatsResult> {
  const empty: StatsResult = { byListing: new Map(), totals: { views: 0, visitors: 0, saves: 0, messages: 0 } };
  if (listingIds !== 'all' && listingIds.length === 0) return empty;

  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  // Rows of one table since the start of the period, for these listings (or all of them).
  const rowsSince = <T,>(table: string, columns: string, timeCol: string) =>
    readAll<T>((from, to) => {
      let q = admin.from(table).select(columns).gte(timeCol, since);
      if (listingIds !== 'all') q = q.in('listing_id', listingIds);
      return q.order(timeCol).range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: unknown }>;
    });

  const [views, saves, threads] = await Promise.all([
    rowsSince<{ listing_id: string; visitor_hash: string; source: ViewSource }>('listing_views', 'listing_id, visitor_hash, source', 'viewed_at'),
    rowsSince<{ listing_id: string; user_id: string }>('buyer_list_items', 'listing_id, user_id', 'created_at'),
    rowsSince<{ listing_id: string }>('conversations', 'listing_id', 'created_at')
  ]);

  type Acc = { views: number; visitors: Set<string>; sources: Map<ViewSource, number>; savers: Set<string>; messages: number };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { views: 0, visitors: new Set(), sources: new Map(), savers: new Set(), messages: 0 }));
    return a;
  };

  const allVisitors = new Set<string>();
  for (const v of views) {
    const a = get(v.listing_id);
    a.views += 1;
    a.visitors.add(v.visitor_hash);
    a.sources.set(v.source, (a.sources.get(v.source) ?? 0) + 1);
    allVisitors.add(v.visitor_hash);
  }
  for (const s of saves) get(s.listing_id).savers.add(s.user_id);
  for (const t of threads) get(t.listing_id).messages += 1;

  const byListing = new Map<string, ListingStats>();
  const totals = { views: views.length, visitors: allVisitors.size, saves: 0, messages: threads.length };
  for (const [id, a] of Array.from(acc)) {
    let top: [ViewSource, number] | null = null;
    for (const entry of Array.from(a.sources)) if (!top || entry[1] > top[1]) top = entry;
    byListing.set(id, {
      views: a.views,
      visitors: a.visitors.size,
      topSource: top ? { label: VIEW_SOURCE_LABELS[top[0]] ?? top[0], share: top[1] / a.views } : null,
      saves: a.savers.size,
      messages: a.messages
    });
    totals.saves += a.savers.size;
  }
  return { byListing, totals };
}
