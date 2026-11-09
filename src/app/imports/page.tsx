import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';
import { claimMessage, claimUrlFor } from '@/lib/claim-message';
import SellerMessageCard from '@/components/imports/SellerMessageCard';
import { REWARD_PERCENT } from '@/lib/rewards';
import DeleteListingButton from '@/components/DeleteListingButton';
import { headers } from 'next/headers';
import MarkTeamBrowser from '@/components/imports/MarkTeamBrowser';
import { SOON_AFTER_MINUTES, clientIp, networkHash } from '@/lib/claim-opens';

interface OpenRow {
  listing_id: string;
  opened_at: string;
  device: string | null;
  app: string | null;
  country: string | null;
  likely_team: boolean;
  team_reason: string | null;
  minutes_after_message: number | null;
}

// Eastern time, like the emails (the server runs in UTC).
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });
const afterText = (m: number) => (m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} hr` : `${Math.round(m / 1440)} days`) + ' after you sent it';

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My imports', robots: { index: false } };

const FOLLOW_UP_DAYS = 5;

type Stage = 'to_message' | 'follow_up' | 'waiting' | 'opened' | 'claimed' | 'live' | 'sold' | 'removed';
const STAGE_LABEL: Record<Stage, string> = {
  to_message: 'Message the seller',
  follow_up: 'Follow up',
  waiting: 'Waiting for the seller',
  opened: 'Opened the link, not claimed yet',
  claimed: 'Claimed: seller is finishing it',
  live: 'Live',
  sold: 'Sold',
  removed: 'Removed'
};
const STAGE_ORDER: Stage[] = ['to_message', 'follow_up', 'waiting', 'opened', 'claimed', 'live', 'sold', 'removed'];

function stageOf(status: string | undefined, claimedAt: string | null, messagedAt: string | null, linkOpenedAt: string | null): Stage {
  if (status === 'sold') return 'sold';
  if (status === 'active' || status === 'pending_sale') return 'live';
  if (status === 'removed') return 'removed';
  if (claimedAt) return 'claimed';
  if (linkOpenedAt) return 'opened';
  if (!messagedAt) return 'to_message';
  return Date.now() - new Date(messagedAt).getTime() > FOLLOW_UP_DAYS * 86_400_000 ? 'follow_up' : 'waiting';
}

export default async function ImportsPage({ searchParams }: { searchParams: { importer?: string; stage?: string; open?: string } }) {
  const { user, isAdmin, isImporter } = await getViewer();
  if (!user) redirect('/auth/login?next=/imports');
  if (!isImporter) redirect('/');

  // Admins can look at anyone's imports (linked from the Users page).
  const importerId = isAdmin && isUuid(searchParams.importer) ? searchParams.importer : user.id;
  const admin = createAdminClient();
  const IMPORT_COLS = 'listing_id, source_url, seller_name, messaged_at, created_at, listings(slug, model, seat_size, tree_width, discipline, status, claimed_at, images, price_cents, price_range_low, price_range_typical, price_range_high, brands(name), listing_claim_tokens(token))';
  const importsQuery = (cols: string) =>
    admin.from('listing_imports').select(cols).eq('importer_id', importerId).order('created_at', { ascending: false }).limit(500);
  const [{ data: rows }, { data: who }, { data: rewards }] = await Promise.all([
    // Newer columns (20261109_claim_link_opens.sql, 20261110_import_message.sql): if one hasn't been
    // run yet, fall back step by step so the page still loads.
    importsQuery(`${IMPORT_COLS}, link_first_opened_at, link_last_opened_at, link_open_count, message`)
      .then((res) => (res.error ? importsQuery(`${IMPORT_COLS}, link_first_opened_at, link_last_opened_at, link_open_count`) : res))
      .then((res) => (res.error ? importsQuery(IMPORT_COLS) : res)),
    importerId !== user.id ? admin.from('profiles').select('full_name, email').eq('id', importerId).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('importer_rewards').select('listing_id, amount_cents, status, void_reason, paid_at').eq('importer_id', importerId)
  ]);
  // Remember this network (hashed) as the importer's, so claim-link opens from it aren't counted as the seller.
  const net = importerId === user.id ? networkHash(clientIp(headers())) : null;
  if (net) {
    const { error: netError } = await admin.from('team_networks').upsert({ network_hash: net, user_id: user.id, last_seen_at: new Date().toISOString() });
    if (netError) console.error('Could not save team network', netError);
  }
  const rewardByListing = new Map((rewards ?? []).map((r) => [r.listing_id, r]));
  const owedCents = (rewards ?? []).filter((r) => r.status === 'earned').reduce((s, r) => s + r.amount_cents, 0);
  const paidCents = (rewards ?? []).filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount_cents, 0);

  const items = (rows ?? []).map((r: any) => {
    const l = r.listings;
    const saddle = l ? `${l.seat_size}" ${l.brands?.name && l.brands.name !== 'Other' ? `${l.brands.name} ` : ''}${l.model}` : 'Saddle';
    const stage = stageOf(l?.status, l?.claimed_at ?? null, r.messaged_at, r.link_first_opened_at ?? null);
    const token = Array.isArray(l?.listing_claim_tokens) ? l.listing_claim_tokens[0]?.token : l?.listing_claim_tokens?.token;
    const claimUrl = token ? claimUrlFor(token) : null;
    // The importer's saved message (with any tips from import time), else a fresh one.
    const message = claimUrl ? r.message ?? claimMessage(r.seller_name, saddle, claimUrl, { hasPhotos: (l?.images?.length ?? 0) > 0, discipline: l?.discipline, fromFounder: isAdmin && importerId === user.id, treeMissing: !!l && !l.tree_width, askingPrice: l?.price_cents ? l.price_cents / 100 : null, priceRange: l?.price_range_typical ? { low: l.price_range_low, typical: l.price_range_typical, high: l.price_range_high } : null }) : null;
    return { ...r, l, saddle, stage, claimUrl, message };
  });
  const counts = STAGE_ORDER.map((s) => [s, items.filter((i) => i.stage === s).length] as const);
  const stageFilter = (STAGE_ORDER as string[]).includes(searchParams.stage ?? '') ? (searchParams.stage as Stage) : null;
  const shown = stageFilter ? items.filter((i) => i.stage === stageFilter) : items;

  // Views in the last 30 days for each saddle (read with the service key; only totals are shown).
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const ids = items.map((i) => i.listing_id);
  const { data: viewRows } = ids.length
    ? await admin.from('listing_views').select('listing_id, visitor_hash').in('listing_id', ids).gte('viewed_at', since).limit(50_000)
    : { data: [] as { listing_id: string; visitor_hash: string }[] };
  const { data: openRows } = ids.length
    ? await admin
        .from('listing_import_opens')
        .select('listing_id, opened_at, device, app, country, likely_team, team_reason, minutes_after_message')
        .in('listing_id', ids)
        .order('opened_at', { ascending: false })
        .limit(5000)
    : { data: [] as OpenRow[] };
  const opensBy = new Map<string, OpenRow[]>();
  for (const o of (openRows ?? []) as OpenRow[]) opensBy.set(o.listing_id, [...(opensBy.get(o.listing_id) ?? []), o]);
  const viewsBy = new Map<string, { views: number; visitors: Set<string> }>();
  for (const v of viewRows ?? []) {
    const e = viewsBy.get(v.listing_id) ?? { views: 0, visitors: new Set<string>() };
    e.views += 1;
    e.visitors.add(v.visitor_hash);
    viewsBy.set(v.listing_id, e);
  }
  const totalViews = (viewRows ?? []).length;
  const messagedCount = items.filter((i) => i.messaged_at).length;
  const openedCount = items.filter((i) => (i.link_open_count ?? 0) > 0).length;
  const claimedCount = items.filter((i) => ['claimed', 'live', 'sold'].includes(i.stage)).length;
  const soldCount = items.filter((i) => i.stage === 'sold').length;
  const pct = (n: number) => (items.length ? `${Math.round((n / items.length) * 100)}%` : '–');
  const tiles: { label: string; value: string | number; note?: string }[] = [
    { label: 'Saddles added', value: items.length },
    { label: 'Sellers messaged', value: messagedCount, note: pct(messagedCount) },
    { label: 'Opened the link', value: openedCount, note: pct(openedCount) },
    { label: 'Claimed', value: claimedCount, note: pct(claimedCount) },
    { label: 'Sold', value: soldCount },
    { label: 'Views, last 30 days', value: totalViews.toLocaleString('en-US') }
  ];
  const stageHref = (s: Stage | null) => {
    const q = new URLSearchParams();
    if (who && searchParams.importer) q.set('importer', searchParams.importer);
    if (s) q.set('stage', s);
    return `/imports${q.toString() ? `?${q}` : ''}`;
  };

  return (
    <div className="py-8">
      {!who && <MarkTeamBrowser />}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h1 className="font-serif text-3xl text-saddle-ink">
          {who ? `Imports by ${who.full_name || who.email}` : 'My imports'}
        </h1>
        {!who && <Link href="/imports/new" className="bg-saddle-green text-white rounded px-4 py-2 font-semibold text-sm">+ Add a saddle</Link>}
      </div>
      <p className="text-saddle-muted mb-4">Tap a saddle to see your message to the seller, its stats, and to edit or delete it.</p>

      <section aria-label="Summary" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white border border-saddle-line rounded p-3">
            <p className="text-xs uppercase tracking-wide text-saddle-muted">{t.label}</p>
            <p className="text-2xl font-bold text-saddle-ink tabular-nums">
              {t.value}
              {t.note && <span className="text-sm font-normal text-saddle-muted ml-1.5">{t.note}</span>}
            </p>
          </div>
        ))}
      </section>

      <section className="bg-saddle-cream border border-saddle-tan rounded p-4 mb-6 flex flex-wrap gap-6 items-center">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-600">Earned, not yet paid</p>
          <p className="text-2xl font-bold text-saddle-green">{usd(owedCents)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-600">Paid so far</p>
          <p className="text-2xl font-bold">{usd(paidCents)}</p>
        </div>
        <p className="text-sm text-gray-700 flex-1 min-w-[16rem]">
          You earn {REWARD_PERCENT}% of what SaddleUp keeps (our fee after card processing) on each saddle you added
          that sells, once the buyer has kept it. Not when you&apos;re the buyer or seller, and not if the sale is refunded.
        </p>
      </section>

      {items.length > 0 && (
        <nav aria-label="Filter by stage" className="flex gap-2 overflow-x-auto pb-2 mb-4 text-sm">
          {([[null, 'All', items.length], ...counts.filter(([, n]) => n > 0).map(([st, n]) => [st, STAGE_LABEL[st], n])] as [Stage | null, string, number][]).map(([st, label, n]) => {
            const active = st === stageFilter;
            return (
              <Link
                key={label}
                href={stageHref(st)}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full border ${active ? 'bg-saddle-brown text-saddle-cream border-saddle-brown' : 'bg-white border-saddle-line hover:border-saddle-brown'}`}
              >
                {label} <span className="tabular-nums opacity-75">{n}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {items.length === 0 && (
        <p className="text-gray-600">Nothing yet. <Link href="/imports/new" className="underline">Add the first saddle you&apos;ve found.</Link></p>
      )}

      <ul className="space-y-2">
        {shown.map((i) => {
          const v = viewsBy.get(i.listing_id);
          // Importers manage a saddle until its seller claims it; admins always can.
          const canManage = isAdmin || !i.l?.claimed_at && !['live', 'sold'].includes(i.stage);
          const needsAction = i.stage === 'follow_up' || i.stage === 'to_message';
          return (
            <li key={i.listing_id} id={`import-${i.listing_id}`} className="scroll-mt-24">
              <details open={searchParams.open === i.listing_id} className="group bg-white border border-saddle-line rounded open:border-saddle-brown">
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.l?.images?.[0] ? <img src={i.l.images[0]} alt="" className="w-14 h-14 object-cover rounded shrink-0" /> : <div className="w-14 h-14 rounded bg-saddle-sand shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-saddle-brown truncate">{i.saddle}</p>
                    <p className="text-sm text-gray-600 truncate">
                      {i.seller_name ? `${i.seller_name} · ` : ''}added {new Date(i.created_at).toLocaleDateString('en-US')}
                      {i.l?.price_cents ? ` · ${usd(i.l.price_cents)}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${needsAction ? 'text-saddle-brown' : i.stage === 'sold' || i.stage === 'live' ? 'text-saddle-green' : 'text-gray-600'}`}>
                      {STAGE_LABEL[i.stage as Stage]}
                    </p>
                    <p className="text-xs text-saddle-muted tabular-nums">
                      {v?.views ?? 0} view{v?.views === 1 ? '' : 's'}
                      {i.link_open_count > 0 ? ` · link opened ${i.link_open_count}×` : ''}
                    </p>
                  </div>
                  <svg aria-hidden viewBox="0 0 20 20" className="w-4 h-4 shrink-0 text-saddle-muted transition-transform group-open:rotate-90"><path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </summary>

                <div className="border-t border-saddle-line p-4 space-y-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {i.l?.slug && i.stage !== 'sold' && i.stage !== 'removed' && (
                      <Link href={`/saddles/${i.l.slug}`} className="underline">View listing</Link>
                    )}
                    {canManage && i.stage !== 'removed' && (
                      <Link href={`/dashboard/listings/${i.listing_id}/edit`} className="underline">Edit</Link>
                    )}
                    {canManage && (
                      <Link href={`/dashboard/listings/${i.listing_id}/stats`} className="underline">Stats</Link>
                    )}
                    {canManage && i.stage !== 'removed' && <DeleteListingButton listingId={i.listing_id} />}
                    <span className="text-saddle-muted">
                      {v?.views ?? 0} views from {v?.visitors.size ?? 0} {v?.visitors.size === 1 ? 'person' : 'people'} in the last 30 days
                    </span>
                  </div>

                  {(i.stage === 'to_message' || i.stage === 'follow_up' || i.stage === 'waiting' || i.stage === 'opened') && i.message && (
                    <SellerMessageCard
                      listingId={i.listing_id}
                      sellerName={i.seller_name}
                      suggested={i.message}
                      saved={i.message}
                      sourceUrl={i.source_url}
                      claimUrl={i.claimUrl!}
                      messagedAt={i.messaged_at}
                      showMarkMessaged={!who}
                    />
                  )}
                  {['claimed', 'live', 'sold', 'removed'].includes(i.stage) && i.message && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-saddle-muted mb-1">Your message to the seller</p>
                      <p className="text-sm whitespace-pre-wrap bg-saddle-paper border border-saddle-line rounded p-3">{i.message}</p>
                    </div>
                  )}
                  {i.link_open_count > 0 && !['live', 'sold', 'removed'].includes(i.stage) && (
                    <p className="text-sm text-saddle-green">
                      👀 Link opened {i.link_open_count === 1 ? 'once' : `${i.link_open_count} times`}
                      {i.link_last_opened_at ? ` · last ${when(i.link_last_opened_at)}` : ''}
                      {i.stage === 'opened' ? '. If that was the seller, they looked but haven’t claimed it yet, so a quick follow-up could help.' : ''}
                    </p>
                  )}
                  {(opensBy.get(i.listing_id)?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-saddle-muted mb-1">Who opened the link</p>
                      <ul className="text-sm space-y-0.5">
                        {opensBy.get(i.listing_id)!.slice(0, 10).map((o, n) => {
                          const soon = o.minutes_after_message != null && o.minutes_after_message <= SOON_AFTER_MINUTES;
                          return (
                            <li key={n} className={o.likely_team ? 'text-saddle-muted' : 'text-saddle-ink'}>
                              {when(o.opened_at)} · {o.device ?? 'Unknown device'}, {o.app ?? 'a browser'}
                              {o.country ? ` · ${o.country}` : ''}
                              {o.minutes_after_message != null ? ` · ${afterText(o.minutes_after_message)}` : ''}
                              {o.likely_team
                                ? ` · probably you (${o.team_reason === 'network' ? 'your network' : 'your browser'}), not counted`
                                : soon
                                  ? ' · so soon it may have been you'
                                  : ''}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {i.stage === 'follow_up' && (
                    <p className="text-xs text-gray-600">Messaged over {FOLLOW_UP_DAYS} days ago and not claimed yet. A friendly nudge often helps.</p>
                  )}
                  {i.stage === 'sold' && (() => {
                    const r = rewardByListing.get(i.listing_id);
                    return (
                      <p className="text-sm">
                        {!r
                          ? 'Your reward is added once the buyer has kept the saddle.'
                          : r.status === 'earned'
                            ? <>You earned <strong>{usd(r.amount_cents)}</strong> (not yet paid)</>
                            : r.status === 'paid'
                              ? <>Paid <strong>{usd(r.amount_cents)}</strong> on {new Date(r.paid_at!).toLocaleDateString('en-US')}</>
                              : <>No reward: {r.void_reason}</>}
                      </p>
                    );
                  })()}
                </div>
              </details>
            </li>
          );
        })}
        {items.length > 0 && shown.length === 0 && <li className="text-saddle-muted">None at this stage.</li>}
      </ul>
    </div>
  );
}
