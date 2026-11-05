import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { DISCIPLINE_LABELS, PANEL_FLOCKING_LABELS, TREE_WIDTH_LABELS } from '@/lib/types';
import { VIEW_SOURCE_LABELS, type ViewSource } from '@/lib/view-source';

export const metadata = { title: 'Listing stats' };
export const dynamic = 'force-dynamic';

const DAYS = 30;

type ViewRow = {
  viewed_at: string;
  visitor_hash: string;
  source: ViewSource;
  region: string | null;
  country: string | null;
  search_filters: Record<string, string | string[]> | null;
};

/** Human-readable label for one search filter value, e.g. tree=medium_wide → "Medium/Wide tree". */
function filterLabel(key: string, value: string): string {
  switch (key) {
    case 'discipline':
      return DISCIPLINE_LABELS[value as keyof typeof DISCIPLINE_LABELS] ?? value;
    case 'tree':
      return `${TREE_WIDTH_LABELS[value as keyof typeof TREE_WIDTH_LABELS] ?? value} tree`;
    case 'panels':
      return PANEL_FLOCKING_LABELS[value as keyof typeof PANEL_FLOCKING_LABELS] ?? value;
    case 'brand':
      return `Brand: ${value.replace(/-/g, ' ')}`;
    case 'seat_min':
      return `Seat ${value}" or larger`;
    case 'seat_max':
      return `Seat ${value}" or smaller`;
    case 'price_max':
      return `Under $${Number(value).toLocaleString()}`;
    default:
      return `${key}: ${value}`;
  }
}

function countBy<T>(items: T[], key: (item: T) => string | null): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function BarList({ rows, total }: { rows: [string, number][]; total: number }) {
  if (!rows.length) return <p className="text-sm text-saddle-muted">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map(([label, n]) => (
        <li key={label} className="text-sm">
          <div className="flex justify-between gap-2 mb-0.5">
            <span className="text-saddle-ink">{label}</span>
            <span className="text-saddle-muted tabular-nums">
              {n} <span className="text-xs">({Math.round((n / Math.max(total, 1)) * 100)}%)</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-saddle-sand overflow-hidden">
            <div className="h-full bg-saddle-green rounded-full" style={{ width: `${(n / Math.max(total, 1)) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-saddle-paper border border-saddle-line rounded p-5 ${className}`}>
      <h2 className="font-serif text-xl text-saddle-ink mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default async function ListingStatsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/dashboard/listings/${params.id}/stats`);

  // Owner or admin only (row-level security returns the listing only to them).
  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, slug, model, seat_size, status, created_at, brands(name)')
    .eq('id', params.id)
    .maybeSingle();
  if (!listing) return notFound();
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (listing.seller_id !== user.id && !profile?.is_admin) return notFound();

  const since = new Date(Date.now() - DAYS * 86_400_000);
  const [{ data: viewData }, { count: allTimeViews }] = await Promise.all([
    supabase
      .from('listing_views')
      .select('viewed_at, visitor_hash, source, region, country, search_filters')
      .eq('listing_id', listing.id)
      .gte('viewed_at', since.toISOString())
      .order('viewed_at', { ascending: true })
      .limit(50_000),
    supabase.from('listing_views').select('id', { count: 'exact', head: true }).eq('listing_id', listing.id)
  ]);
  const views = (viewData ?? []) as ViewRow[];

  // Favorites and message threads belong to buyers, so count them with the service key
  // (only the totals are shown — never who).
  const admin = createAdminClient();
  const [{ count: favorites }, { count: conversations }] = await Promise.all([
    admin.from('favorites').select('listing_id', { count: 'exact', head: true }).eq('listing_id', listing.id),
    admin.from('conversations').select('id', { count: 'exact', head: true }).eq('listing_id', listing.id)
  ]);

  const visitors = new Set(views.map((v) => v.visitor_hash)).size;

  // Daily views for the last 30 days (UTC days), oldest → newest.
  const days: { label: string; key: string; views: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      views: 0
    });
  }
  const byDay = new Map(days.map((d) => [d.key, d]));
  for (const v of views) {
    const day = byDay.get(v.viewed_at.slice(0, 10));
    if (day) day.views += 1;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.views));

  const sources = countBy(views, (v) => VIEW_SOURCE_LABELS[v.source] ?? v.source);
  const regions = countBy(views, (v) =>
    v.region && v.country === 'US' ? v.region : v.country ? (v.country === 'US' ? 'United States' : v.country) : null
  ).slice(0, 8);
  const searchViews = views.filter((v) => v.search_filters);
  const filters = countBy(
    searchViews.flatMap((v) =>
      Object.entries(v.search_filters ?? {}).flatMap(([k, val]) => (Array.isArray(val) ? val : [val]).map((x) => filterLabel(k, x)))
    ),
    (label) => label
  ).slice(0, 10);

  const brand = (listing.brands as unknown as { name: string } | null)?.name;
  const title = `${listing.seat_size}" ${brand && brand !== 'Other' ? `${brand} ` : ''}${listing.model}`;

  return (
    <div className="py-8 space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm underline text-saddle-brown">
          ← My listings
        </Link>
        <h1 className="font-serif text-3xl text-saddle-ink mt-2">{title}</h1>
        <p className="text-sm text-saddle-muted">
          Stats for the last {DAYS} days ·{' '}
          <Link href={`/saddles/${listing.slug}`} className="underline">
            View listing
          </Link>
          {listing.status !== 'active' && ' · Not live yet, so no views are being counted.'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Views', views.length],
          ['Visitors', visitors],
          ['Favorited', favorites ?? 0],
          ['Messages', conversations ?? 0]
        ].map(([label, n]) => (
          <div key={label} className="bg-saddle-paper border border-saddle-line rounded p-4">
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold">{label}</div>
            <div className="font-serif text-3xl text-saddle-ink tabular-nums">{Number(n).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-saddle-muted -mt-3">
        {(allTimeViews ?? 0).toLocaleString()} views since listing. Visitors are counted per day; your own visits
        aren&apos;t counted. Favorites and messages are all-time totals.
      </p>

      <Card title="Views per day">
        <div className="flex items-end gap-[3px] h-40" role="img" aria-label="Views per day for the last 30 days">
          {days.map((d) => (
            <div key={d.key} className="flex-1 h-full flex flex-col justify-end group relative">
              <div
                className="bg-saddle-green rounded-t-sm min-h-[2px]"
                style={{ height: `${(d.views / maxDay) * 100}%`, opacity: d.views ? 1 : 0.25 }}
                title={`${d.label}: ${d.views} view${d.views === 1 ? '' : 's'}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-saddle-muted mt-1">
          <span>{days[0].label}</span>
          <span>{days[days.length - 1].label}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Where buyers came from">
          <BarList rows={sources} total={views.length} />
        </Card>
        <Card title="Where buyers are">
          <BarList rows={regions} total={views.length} />
        </Card>
      </div>

      <Card title="What buyers searched for">
        {filters.length ? (
          <>
            <p className="text-sm text-saddle-muted mb-3">
              Filters used by the {searchViews.length} buyer{searchViews.length === 1 ? '' : 's'} who found this saddle
              through SaddleUp search.
            </p>
            <BarList rows={filters} total={searchViews.length} />
          </>
        ) : (
          <p className="text-sm text-saddle-muted">No buyers have found this through filtered search yet.</p>
        )}
      </Card>
    </div>
  );
}
