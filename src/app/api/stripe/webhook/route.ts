import { NextResponse } from 'next/server';
import { stripe, calcCommissionCents } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// Stripe requires the raw body to verify the webhook signature, so this
// route must NOT run through Next's default JSON body parsing.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { listing_id, buyer_id, seller_id } = session.metadata ?? {};
    const salePriceCents = session.amount_total ?? 0;
    const commissionCents = calcCommissionCents(salePriceCents);

    await admin.from('orders').insert({
      listing_id,
      buyer_id,
      seller_id,
      sale_price_cents: salePriceCents,
      commission_cents: commissionCents,
      seller_payout_cents: salePriceCents - commissionCents,
      stripe_payment_intent_id: session.payment_intent as string,
      status: 'paid',
      payout_status: 'held',
      release_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    });

    await admin.from('listings').update({ status: 'sold' }).eq('id', listing_id);
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    await admin
      .from('profiles')
      .update({ stripe_connect_onboarded: !!account.charges_enabled })
      .eq('stripe_connect_account_id', account.id);
  }

  return NextResponse.json({ received: true });
}
