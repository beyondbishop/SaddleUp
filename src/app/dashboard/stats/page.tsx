import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadListingStats, parseRange } from '@/lib/listing-stats';
import { listingTitle } from '@/lib/listing-title';
import StatsOverview, { parseSort, type StatsRow } from '@/components/stats/StatsOverview';

// A seller's stats across all their saddles: views, visitors, top source, saves and messages.

export const metadata = { title: 'My saddle stats' };
export const dynamic = 'force-dynamic';

type SP = { [key: string]: string | string[] | undefined };

export default async function SellerStatsPage({ searchParams }: { searchParams: SP }) {
  const days = parseRange(searchParams.days);
  const sort = parseSort(searchParams.sort);
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/dashboard/stats?days=${days}&sort=${sort}`)}`);

  // Only this seller's saddles (selected by seller_id; stats are then read for just these ids).
  const { data: listings } = await supabase
    .from('listings')
    .select('id, slug, status, seat_size, model, brands(name)')
    .eq('seller_id', user.id)
    .in('status', ['active', 'pending_sale', 'sold'])
    .order('created_at', { ascending: false });

  const own = (listings ?? []) as unknown as { id: string; slug: string | null; status: string; seat_size: number; model: string; brands: { name: string } | null }[];
  const stats = await loadListingStats(own.map((l) => l.id), days);
  const rows: StatsRow[] = own.map((l) => ({ id: l.id, title: listingTitle(l), slug: l.slug, status: l.status }));

  return (
    <>
      <Link href="/dashboard" className="inline-block mt-6 text-sm underline text-saddle-brown">
        ← Your listings
      </Link>
      <StatsOverview
        heading="My saddle stats"
        intro="How shoppers are finding your saddles. Click a column to sort, or a saddle for its full stats."
        basePath="/dashboard/stats"
        days={days}
        sort={sort}
        rows={rows}
        stats={stats}
        empty={
          <p className="text-sm text-saddle-muted">
            Stats appear here once one of your saddles is live.{' '}
            <Link href="/dashboard/listings/new" className="underline">List a saddle</Link>
          </p>
        }
      />
    </>
  );
}
