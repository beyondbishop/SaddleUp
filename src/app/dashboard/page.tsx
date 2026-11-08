import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ConnectPayoutsButton from '@/components/ConnectPayoutsButton';
import DeleteListingButton from '@/components/DeleteListingButton';
import { refreshSellerPayoutStatus } from '@/lib/stripe-connect';
import { avatarUrlFor } from '@/lib/avatar';
import { SELLER_FEE_CAP_DOLLARS, SELLER_KEEPS_PERCENT } from '@/lib/fees';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/dashboard');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  // Started payout setup but not marked ready yet (e.g. just back from Stripe): ask Stripe.
  const payoutsReady =
    !!profile?.stripe_connect_onboarded ||
    (!!profile?.stripe_connect_account_id && (await refreshSellerPayoutStatus(user.id)));
  const payoutsStarted = !!profile?.stripe_connect_account_id;
  const { data: listings } = await supabase
    .from('listings')
    .select('*, brands(name)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  // Views in the last 30 days per listing (row-level security limits this to the seller's own).
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const ids = (listings ?? []).map((l) => l.id);
  const { data: views } = ids.length
    ? await supabase.from('listing_views').select('listing_id, visitor_hash').in('listing_id', ids).gte('viewed_at', since).limit(50_000)
    : { data: [] as { listing_id: string; visitor_hash: string }[] };
  const stats = new Map<string, { views: number; visitors: Set<string> }>();
  for (const v of views ?? []) {
    const s = stats.get(v.listing_id) ?? { views: 0, visitors: new Set<string>() };
    s.views += 1;
    s.visitors.add(v.visitor_hash);
    stats.set(v.listing_id, s);
  }

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-saddle-brown">Your Listings</h1>
        <Link href="/dashboard/listings/new" className="bg-saddle-green text-white px-4 py-2 rounded-md font-semibold">
          + New Listing
        </Link>
      </div>

      {!avatarUrlFor(user) && (
        <div className="bg-white border border-saddle-line rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
          <p className="text-sm">
            <strong>Add a headshot.</strong> It shows on every saddle you list, so buyers can see who they’re buying from.
          </p>
          <Link href="/account/profile" className="shrink-0 border border-saddle-tan-line text-saddle-brown rounded-md px-3 py-1.5 text-sm font-semibold">Add photo</Link>
        </div>
      )}

      {!payoutsReady && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
          <p className="text-sm">
            {payoutsStarted
              ? 'Your payout setup isn’t finished yet. Buyers can’t check out on your saddles until Stripe has the details it needs. If you just finished, Stripe may still be reviewing them; check back shortly.'
              : `Set up payouts to start receiving money from sales (SaddleUp uses Stripe Connect — during our beta you keep ${SELLER_KEEPS_PERCENT}% of every sale, or the sale price minus $${SELLER_FEE_CAP_DOLLARS}, whichever is less).`}
          </p>
          <ConnectPayoutsButton label={payoutsStarted ? 'Finish Payout Setup' : 'Set Up Payouts'} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {listings?.map((l) => (
          <div key={l.id} className="bg-white border border-saddle-tan rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {l.seat_size}&quot; {l.brands?.name} {l.model}
              </p>
              <p className="text-sm text-gray-500">
                {l.status} · ${(l.price_cents / 100).toLocaleString()}
              </p>
              {l.status === 'active' && (
                <p className="text-sm text-saddle-green">
                  {stats.get(l.id)?.views ?? 0} view{stats.get(l.id)?.views === 1 ? '' : 's'} ·{' '}
                  {stats.get(l.id)?.visitors.size ?? 0} visitor{stats.get(l.id)?.visitors.size === 1 ? '' : 's'}{' '}
                  <span className="text-gray-500">(last 30 days)</span>
                </p>
              )}
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/saddles/${l.slug}`} className="underline">View</Link>
              <Link href={`/dashboard/listings/${l.id}/stats`} className="underline">Stats</Link>
              <Link href={`/dashboard/listings/${l.id}/edit`} className="underline">Edit</Link>
              <DeleteListingButton listingId={l.id} />
            </div>
          </div>
        ))}
        {listings?.length === 0 && <p className="text-gray-500">You haven&apos;t listed a saddle yet.</p>}
      </div>
    </div>
  );
}
