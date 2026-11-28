import { createAdminClient } from '@/lib/supabase/server';
import { FOR_SALE } from '@/lib/search';
import { loadListingStats, parseRange, readAll } from '@/lib/listing-stats';
import { listingTitle } from '@/lib/listing-title';
import StatsOverview, { parseSort, type StatsRow } from '@/components/stats/StatsOverview';

// Admin: views, visitors, top source, saves and messages for every saddle shoppers can see, plus
// ones mid-sale or sold. The admin layout already checks the viewer is an admin.

export const metadata = { title: 'Stats' };
export const dynamic = 'force-dynamic';

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminStatsPage({ searchParams }: { searchParams: SP }) {
  const days = parseRange(searchParams.days);
  const sort = parseSort(searchParams.sort);
  const admin = createAdminClient();

  const [listings, stats] = await Promise.all([
    readAll<{ id: string; slug: string | null; status: string; seat_size: number; model: string; brands: { name: string } | null }>(
      (from, to) =>
        admin
          .from('listings')
          .select('id, slug, status, seat_size, model, brands(name)')
          .or(`${FOR_SALE},status.in.(pending_sale,sold)`)
          .order('created_at', { ascending: false })
          .range(from, to) as unknown as PromiseLike<{ data: any[] | null; error: unknown }>
    ),
    loadListingStats('all', days)
  ]);

  const rows: StatsRow[] = listings.map((l) => ({ id: l.id, title: listingTitle(l), slug: l.slug, status: l.status }));

  return (
    <StatsOverview
      heading="Saddle stats"
      intro="Every saddle shoppers can see, plus ones that are mid-sale or sold. Click a column to sort."
      basePath="/admin/stats"
      days={days}
      sort={sort}
      rows={rows}
      stats={stats}
      empty={<p className="text-sm text-saddle-muted">No saddles are listed yet.</p>}
    />
  );
}
