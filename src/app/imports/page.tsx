import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';
import { claimMessage, claimUrlFor } from '@/lib/claim-message';
import CopyButton from '@/components/imports/CopyButton';
import MarkMessagedButton from '@/components/imports/MarkMessagedButton';
import OpenPostLink from '@/components/imports/OpenPostLink';
import { REWARD_PERCENT } from '@/lib/rewards';

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

export default async function ImportsPage({ searchParams }: { searchParams: { importer?: string } }) {
  const { user, isAdmin, isImporter } = await getViewer();
  if (!user) redirect('/auth/login?next=/imports');
  if (!isImporter) redirect('/');

  // Admins can look at anyone's imports (linked from the Users page).
  const importerId = isAdmin && isUuid(searchParams.importer) ? searchParams.importer : user.id;
  const admin = createAdminClient();
  const IMPORT_COLS = 'listing_id, source_url, seller_name, messaged_at, created_at, listings(slug, model, seat_size, status, claimed_at, claim_token, images, brands(name))';
  const importsQuery = (cols: string) =>
    admin.from('listing_imports').select(cols).eq('importer_id', importerId).order('created_at', { ascending: false }).limit(500);
  const [{ data: rows }, { data: who }, { data: rewards }] = await Promise.all([
    // Link-open tracking columns come from 20261109_claim_link_opens.sql; until that's run, load without them.
    importsQuery(`${IMPORT_COLS}, link_first_opened_at, link_last_opened_at, link_open_count`).then((res) =>
      res.error ? importsQuery(IMPORT_COLS) : res
    ),
    importerId !== user.id ? admin.from('profiles').select('full_name, email').eq('id', importerId).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('importer_rewards').select('listing_id, amount_cents, status, void_reason, paid_at').eq('importer_id', importerId)
  ]);
  const rewardByListing = new Map((rewards ?? []).map((r) => [r.listing_id, r]));
  const owedCents = (rewards ?? []).filter((r) => r.status === 'earned').reduce((s, r) => s + r.amount_cents, 0);
  const paidCents = (rewards ?? []).filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount_cents, 0);

  const items = (rows ?? []).map((r: any) => {
    const l = r.listings;
    const saddle = l ? `${l.seat_size}" ${l.brands?.name && l.brands.name !== 'Other' ? `${l.brands.name} ` : ''}${l.model}` : 'Saddle';
    const stage = stageOf(l?.status, l?.claimed_at ?? null, r.messaged_at, r.link_first_opened_at ?? null);
    const claimUrl = l?.claim_token ? claimUrlFor(l.claim_token) : null;
    return { ...r, l, saddle, stage, claimUrl, message: claimUrl ? claimMessage(r.seller_name, saddle, claimUrl, { hasPhotos: (l?.images?.length ?? 0) > 0 }) : null };
  });
  const counts = STAGE_ORDER.map((s) => [s, items.filter((i) => i.stage === s).length] as const);

  return (
    <div className="py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h1 className="font-serif text-3xl text-saddle-ink">
          {who ? `Imports by ${who.full_name || who.email}` : 'My imports'}
        </h1>
        {!who && <Link href="/imports/new" className="bg-saddle-green text-white rounded px-4 py-2 font-semibold text-sm">+ Add a saddle</Link>}
      </div>
      <p className="text-saddle-muted mb-4">{items.length} saddles added</p>

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

      <ul className="flex flex-wrap gap-2 mb-6 text-sm">
        {counts.filter(([, n]) => n > 0).map(([s, n]) => (
          <li key={s} className="bg-white border border-saddle-line rounded px-3 py-1">{STAGE_LABEL[s]}: <strong>{n}</strong></li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="text-gray-600">Nothing yet. <Link href="/imports/new" className="underline">Add the first saddle you&apos;ve found.</Link></p>
      )}

      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.listing_id} className="bg-white border border-saddle-line rounded p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-saddle-brown">{i.saddle}</p>
                <p className="text-sm text-gray-600">
                  {i.seller_name ? `${i.seller_name} · ` : ''}added {new Date(i.created_at).toLocaleDateString('en-US')}
                </p>
              </div>
              <span className={`text-sm font-semibold ${i.stage === 'follow_up' || i.stage === 'to_message' ? 'text-saddle-brown' : i.stage === 'sold' || i.stage === 'live' ? 'text-saddle-green' : 'text-gray-600'}`}>
                {STAGE_LABEL[i.stage as Stage]}
              </span>
            </div>

            {(i.stage === 'to_message' || i.stage === 'follow_up' || i.stage === 'waiting' || i.stage === 'opened') && i.message && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CopyButton text={i.message} label={i.stage === 'follow_up' ? 'Copy message to resend' : 'Copy message'} />
                <CopyButton text={i.claimUrl!} label="Copy claim link" />
                {i.source_url && (
                  <OpenPostLink url={i.source_url} />
                )}
                {!who && <MarkMessagedButton listingId={i.listing_id} messagedAt={i.messaged_at} />}
              </div>
            )}
            {i.link_open_count > 0 && !['live', 'sold', 'removed'].includes(i.stage) && (
              <p className="text-sm text-saddle-green mt-2">
                👀 Seller opened the link {i.link_open_count === 1 ? 'once' : `${i.link_open_count} times`}
                {' '}· last {new Date(i.link_last_opened_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {i.stage === 'opened' ? '. They looked but haven’t claimed it yet, so a quick follow-up could help.' : ''}
              </p>
            )}
            {i.stage === 'follow_up' && (
              <p className="text-xs text-gray-600 mt-2">Messaged over {FOLLOW_UP_DAYS} days ago and not claimed yet. A friendly nudge often helps.</p>
            )}
            {i.stage === 'sold' && (() => {
              const r = rewardByListing.get(i.listing_id);
              return (
                <p className="text-sm mt-2">
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
            {/* Sold listings aren't public any more, so only live ones get a link. */}
            {i.stage === 'live' && i.l?.slug && (
              <Link href={`/saddles/${i.l.slug}`} className="text-sm underline mt-2 inline-block">View listing</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
