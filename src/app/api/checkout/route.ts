import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

// Stripe's minimum Checkout Session lifetime is 30 minutes. The reservation lasts a little
// longer so a payment completed at the last second still matches it.
const SESSION_MINUTES = 30;
const RESERVATION_GRACE_MINUTES = 5;

export async function POST(req: Request) {
  const { listingId } = await req.json().catch(() => ({}));
  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  if (typeof listingId !== 'string') return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const { data: listing } = await admin
    .from('listings')
    .select('*, profiles!listings_seller_id_fkey(stripe_connect_account_id, stripe_connect_onboarded)')
    .eq('id', listingId)
    .single();

  if (!listing || !['active', 'pending_sale'].includes(listing.status)) {
    return NextResponse.json({ error: 'This saddle is no longer available.' }, { status: 400 });
  }
  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: "You can't buy your own saddle." }, { status: 400 });
  }

  const seller = (listing as any).profiles;
  if (!seller?.stripe_connect_onboarded || !seller?.stripe_connect_account_id) {
    return NextResponse.json(
      { error: 'This seller has not finished payout setup yet. Check back soon.' },
      { status: 400 }
    );
  }

  // Hold the saddle for this buyer so nobody else can pay for it at the same time.
  const now = Date.now();
  const sessionExpiresAt = Math.floor(now / 1000) + SESSION_MINUTES * 60;
  const reservationExpiresAt = new Date(now + (SESSION_MINUTES + RESERVATION_GRACE_MINUTES) * 60 * 1000);

  const { data: reservation, error: reserveError } = await admin.rpc('reserve_listing', {
    p_listing_id: listing.id,
    p_buyer_id: user.id,
    p_expires_at: reservationExpiresAt.toISOString()
  });
  if (reserveError) {
    console.error('reserve_listing failed', reserveError);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  if (reservation === 'unavailable') {
    return NextResponse.json(
      {
        error:
          listing.status === 'pending_sale'
            ? 'Another buyer is checking out with this saddle. If they don’t finish, it will be available again within about 30 minutes.'
            : 'This saddle is no longer available.'
      },
      { status: 409 }
    );
  }

  // Same buyer clicked Buy again: close their earlier checkout so only one can be paid.
  if (typeof reservation === 'string' && reservation.startsWith('renewed:')) {
    const oldSessionId = reservation.slice('renewed:'.length);
    try {
      await stripe.checkout.sessions.expire(oldSessionId);
    } catch {
      const old = await stripe.checkout.sessions.retrieve(oldSessionId).catch(() => null);
      if (old?.status === 'complete') {
        return NextResponse.json(
          { error: 'Your payment for this saddle is already being processed. Check your orders shortly.' },
          { status: 409 }
        );
      }
    }
  }

  const release = () =>
    admin.rpc('release_reservation', { p_listing_id: listing.id, p_buyer_id: user.id });

  try {
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
      // paid out via a separate Transfer (see src/lib/payouts.ts) once the buyer
      // confirms receipt or the inspection window after delivery elapses.
      customer_email: user.email,
      expires_at: sessionExpiresAt,
      metadata: { listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id },
      payment_intent_data: { metadata: { listing_id: listing.id, buyer_id: user.id } },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/orders?purchased=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/saddles/${listing.slug}?canceled=1`
    });

    const { data: attached } = await admin.rpc('attach_reservation_session', {
      p_listing_id: listing.id,
      p_buyer_id: user.id,
      p_session_id: session.id
    });
    if (!attached) {
      // Lost the reservation in between (e.g. a second click). Don't let this session be paid.
      await stripe.checkout.sessions.expire(session.id).catch(() => {});
      return NextResponse.json({ error: 'Please try again.' }, { status: 409 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('Checkout session creation failed', e);
    await release();
    return NextResponse.json({ error: 'Checkout failed. Please try again.' }, { status: 500 });
  }
}
