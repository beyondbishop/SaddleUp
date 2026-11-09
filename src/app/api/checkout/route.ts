import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { refreshSellerPayoutStatus } from '@/lib/stripe-connect';
import { SITE_URL } from '@/lib/site';

// Stripe's minimum Checkout Session lifetime is 30 minutes. The reservation lasts a little
// longer so a payment completed at the last second still matches it.
const SESSION_MINUTES = 30;
const RESERVATION_GRACE_MINUTES = 5;

export async function POST(req: Request) {
  const { listingId, quoteId, fulfillment } = await req.json().catch(() => ({}));
  // The buyer picks shipping (default) or local pickup. Pickup pays only the saddle price.
  const pickup = fulfillment === 'pickup';
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
  const sellerReady =
    !!seller?.stripe_connect_account_id &&
    (seller.stripe_connect_onboarded || (await refreshSellerPayoutStatus(listing.seller_id)));
  if (!sellerReady) {
    return NextResponse.json(
      { error: 'This seller has not finished payout setup yet. Check back soon.' },
      { status: 400 }
    );
  }

  // Pickup only when the seller offers it (the column is missing until the pickup SQL is run,
  // which reads as "not offered").
  if (pickup && (listing as any).pickup_available !== true) {
    return NextResponse.json({ error: 'The seller doesn’t offer local pickup for this saddle.' }, { status: 400 });
  }

  // The shipping price the buyer saw for their ZIP. Checkout charges exactly that.
  if (!pickup && typeof quoteId !== 'string') {
    return NextResponse.json({ error: 'Enter your ZIP code to get the shipping price first.' }, { status: 400 });
  }
  const quote = pickup
    ? null
    : (
        await admin
          .from('shipping_quotes')
          .select('id, listing_id, buyer_id, to_zip, amount_cents, service_name, insured_cents, expires_at')
          .eq('id', quoteId)
          .maybeSingle()
      ).data;
  if (
    !pickup &&
    (!quote ||
      quote.listing_id !== listing.id ||
      (quote.buyer_id && quote.buyer_id !== user.id) ||
      new Date(quote.expires_at).getTime() < Date.now() ||
      quote.insured_cents !== listing.price_cents)
  ) {
    return NextResponse.json({ error: 'Your shipping price has expired. Please check it again.', requote: true }, { status: 409 });
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
      // The Stripe account has Managed Payments (Stripe as merchant of record) on by default.
      // It's meant for digital goods and rejects payment_method_types; SaddleUp sells physical
      // saddles and pays sellers by separate transfer, so turn it off for these sessions.
      // (Not in stripe-node v16's types yet.)
      ...({ managed_payments: { enabled: false } } as Record<string, unknown>),
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${listing.model} — ${listing.seat_size}"${listing.tree_width ? ` ${listing.tree_width}` : ''}` },
            unit_amount: listing.price_cents
          },
          quantity: 1
        },
        ...(quote
          ? [
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `Shipping to ${quote.to_zip}`,
                    description: `${quote.service_name ?? 'Ground'} · signature on delivery · insured for the full price`
                  },
                  unit_amount: quote.amount_cents
                },
                quantity: 1
              }
            ]
          : [])
      ],
      // Shipping: the buyer's address (US only); the phone number goes on the label for the carrier.
      // Pickup: no address, but the phone lets the seller arrange the handover.
      ...(pickup ? {} : { shipping_address_collection: { allowed_countries: ['US' as const] } }),
      phone_number_collection: { enabled: true },
      // Sales tax: off until SaddleUp is registered where it's owed. STRIPE_AUTOMATIC_TAX=on enables it.
      ...(process.env.STRIPE_AUTOMATIC_TAX === 'on' ? { automatic_tax: { enabled: true } } : {}),
      // NOTE: no transfer_data/application_fee_amount here on purpose. Funds are
      // charged to the platform's own Stripe balance and held. The seller is
      // paid out via a separate Transfer (see src/lib/payouts.ts) once the buyer
      // confirms receipt or the inspection window after delivery elapses.
      custom_text: {
        submit: {
          message: quote
            ? `5-day trial from delivery. If you send it back, you pay return shipping (about $${(quote.amount_cents / 100).toFixed(2)}), unless the saddle isn't as described.`
            : `Local pickup${listing.location_city ? ` near ${listing.location_city}${listing.location_state ? `, ${listing.location_state}` : ''}` : ''}. The seller will contact you to arrange it. Your 5-day trial starts at pickup.`
        }
      },
      customer_email: user.email,
      expires_at: sessionExpiresAt,
      // Set by the server, so the webhook can trust these amounts.
      metadata: {
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        saddle_cents: String(listing.price_cents),
        shipping_cents: String(quote?.amount_cents ?? 0),
        fulfillment: pickup ? 'pickup' : 'ship',
        ...(quote ? { quote_id: quote.id, quote_zip: quote.to_zip } : {})
      },
      payment_intent_data: { metadata: { listing_id: listing.id, buyer_id: user.id } },
      success_url: `${SITE_URL}/orders?purchased=1`,
      cancel_url: `${SITE_URL}/saddles/${listing.slug}?canceled=1`
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
