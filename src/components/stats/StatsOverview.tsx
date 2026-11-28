import Link from 'next/link';
import { STAT_RANGES, type ListingStats, type StatRange, type StatsResult } from '@/lib/listing-stats';

// The stats overview shared by /admin/stats (every saddle) and /dashboard/stats (a seller's own):
// a 7/30/90-day switch, totals, and one sortable row per saddle linking to its full stats page.
// Server-rendered; sorting and the range switch are plain links, so no client JavaScript.

export const SORTS = ['views', 'visitors', 'saves', 'messages'] as const;
export type Sort = (typeof SORTS)[number];
export const parseSort = (v: unknown): Sort => {
  const s = String(Array.isArray(v) ? v[0] : v);
  return (SORTS as readonly string[]).includes(s) ? (s as Sort) : 'views';
};

export type StatsRow = { id: string; title: string; slug: string | null; status: string };

/** Views but nobody saving or messaging: worth a look at price, photos or description. */
const NO_INTEREST_MIN_VIEWS = 10;

const STATUS_LABELS: Record<string, string> = {
  active: 'Live',
  unclaimed: 'Unclaimed',
  pending_sale: 'Sale pending',
  sold: 'Sold'
};

const ZERO: ListingStats = { views: 0, visitors: 0, topSource: null, saves: 0, messages: 0 };

export default function StatsOverview({
  heading,
  intro,
  basePath,
  days,
  sort,
  rows,
  stats,
  empty
}: {
  heading: string;
  intro: React.ReactNode;
  basePath: string;
  days: StatRange;
  sort: Sort;
  rows: StatsRow[];
  stats: StatsResult;
  empty: React.ReactNode;
}) {
  const href = (d: StatRange, s: Sort) => `${basePath}?days=${d}&sort=${s}`;
  const sorted = rows
    .map((r) => ({ ...r, s: stats.byListing.get(r.id) ?? ZERO }))
    .sort((a, b) => b.s[sort] - a.s[sort] || b.s.views - a.s.views || a.title.localeCompare(b.title));
  const flagged = sorted.filter((r) => r.s.views >= NO_INTEREST_MIN_VIEWS && !r.s.saves && !r.s.messages).length;

  const Th = ({ col, label }: { col: Sort; label: string }) => (
    <th scope="col" className="px-3 py-2 text-right font-normal" aria-sort={sort === col ? 'descending' : undefined}>
      <Link
        href={href(days, col)}
        className={`whitespace-nowrap hover:text-saddle-ink ${sort === col ? 'text-saddle-ink font-semibold' : ''}`}
      >
        {label}
        {sort === col ? ' ↓' : ''}
      </Link>
    </th>
  );

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-saddle-ink">{heading}</h1>
          <p className="text-sm text-saddle-muted mt-1 max-w-2xl">{intro}</p>
        </div>
        <nav aria-label="Time range" className="flex rounded border border-saddle-line overflow-hidden text-sm">
          {STAT_RANGES.map((d) => (
            <Link
              key={d}
              href={href(d, sort)}
              aria-current={d === days ? 'page' : undefined}
              className={`px-3 py-1.5 ${d === days ? 'bg-saddle-brown text-saddle-cream' : 'bg-saddle-paper text-saddle-nav hover:bg-saddle-sand'}`}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ['Views', stats.totals.views],
            ['Visitors', stats.totals.visitors],
            ['Saved by buyers', stats.totals.saves],
            ['New messages', stats.totals.messages]
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="bg-saddle-paper border border-saddle-line rounded p-4">
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold">{label}</div>
            <div className="font-serif text-3xl text-saddle-ink tabular-nums">{n.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="bg-saddle-paper border border-saddle-line rounded p-6">{empty}</div>
      ) : (
        <>
          {flagged > 0 && (
            <p className="text-sm bg-saddle-paper border border-saddle-line rounded px-4 py-3">
              <span className="font-semibold">{flagged} saddle{flagged === 1 ? ' is' : 's are'} getting views but no interest</span>{' '}
              (at least {NO_INTEREST_MIN_VIEWS} views, no saves or messages). The price, photos or description may be worth
              a second look.
            </p>
          )}
          <div className="bg-saddle-paper border border-saddle-line rounded overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-saddle-muted border-b border-saddle-line">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-normal">Saddle</th>
                  <Th col="views" label="Views" />
                  <Th col="visitors" label="Visitors" />
                  <th scope="col" className="px-3 py-2 text-left font-normal">Top source</th>
                  <Th col="saves" label="Saves" />
                  <Th col="messages" label="Messages" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const noInterest = r.s.views >= NO_INTEREST_MIN_VIEWS && !r.s.saves && !r.s.messages;
                  return (
                    <tr key={r.id} className="border-b border-saddle-line last:border-0 align-top">
                      <td className="px-3 py-2.5">
                        <Link href={`/dashboard/listings/${r.id}/stats`} className="text-saddle-ink underline hover:text-saddle-brown">
                          {r.title}
                        </Link>
                        <div className="text-xs text-saddle-muted mt-0.5">
                          {STATUS_LABELS[r.status] ?? r.status.replace('_', ' ')}
                          {r.slug && (
                            <>
                              {' · '}
                              <Link href={`/saddles/${r.slug}`} className="underline">View listing</Link>
                            </>
                          )}
                          {noInterest && (
                            <span className="ml-2 inline-block rounded-full bg-saddle-sand text-saddle-ink px-2 leading-5">
                              Views, no interest
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.s.views.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.s.visitors.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-saddle-body">
                        {r.s.topSource ? (
                          <>
                            {r.s.topSource.label}{' '}
                            <span className="text-saddle-muted">{Math.round(r.s.topSource.share * 100)}%</span>
                          </>
                        ) : (
                          <span className="text-saddle-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.s.saves.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.s.messages.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-saddle-muted">
            Last {days} days. Visitors are counted once per day, and sellers&apos; visits to their own saddles aren&apos;t
            counted. Saves count each buyer once, however many lists they used. Click a saddle for its daily views, where
            visitors are, and what they searched for.
          </p>
        </>
      )}
    </div>
  );
}
