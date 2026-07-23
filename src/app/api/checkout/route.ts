import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripe, calcCommissionCents } from '@/lib/stripe';

export async function POST(req: Request) {
  const { listingId } = await req.json();
  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  const { data: listing } = await admin
    .from('listings')
    .select('*, profiles!listings_seller_id_fkey(stripe_connect_account_id, stripe_connect_onboarded)')
    .eq('id', listingId)
    .single();

  if (!listing || listing.status !== 'active') {
    return NextResponse.json({ error: 'This saddle is no longer available.' }, { status: 400 });
  }

  const seller = (listing as any).profiles;
  if (!seller?.stripe_connect_onboarded || !seller?.stripe_connect_account_id) {
    return NextResponse.json(
      { error: 'This seller has not finished payout setup yet. Check back soon.' },
      { status: 400 }
    );
  }

  const commissionCents = calcCommissionCents(listing.price_cents);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `${listing.model} — ${listing.seat_size}" ${listing.tree_width}` },
          unit_amount: listing.price_cents
        },
        quantity: 1
      }
    ],
    // NOTE: no transfer_data/application_fee_amount here on purpose. Funds are
    // charged to the platform's own Stripe balance and held. The seller is
    // paid out via a separate Transfer (see /api/orders/confirm-receipt and
    // /api/cron/release-payouts) once the buyer confirms receipt or the
    // trial/inspection window elapses — that's the trust-building mechanism:
    // a buyer's money isn't released to the seller until they've had a
    // chance to check the saddle fits.
    customer_email: user.email,
    metadata: { listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/saddles/${listing.slug}?purchased=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/saddles/${listing.slug}`
  });

  return NextResponse.json({ url: session.url });
}
