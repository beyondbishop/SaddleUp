import { NextResponse } from 'next/server';
import { stripe, calcCommissionCents, COMMISSION_PERCENT } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { voidRewardForRefund } from '@/lib/rewards';
import { addBusinessDays, BUYER_TERMS_VERSION, DISPATCH_BUSINESS_DAYS, logOrderEvent } from '@/lib/orders';

// Stripe requires the raw body to verify the webhook signature, so this
// route must NOT run through Next's default JSON body parsing.
export const runtime = 'nodejs';

// Stripe can deliver the same event more than once, and out of order. Every handler here
// must be safe to run repeatedly. If a handler throws, we return 500 so Stripe retries.
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
        await releaseReservation(event.data.object as Stripe.Checkout.Session);
        break;
      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge);
        break;
      case 'charge.dispute.created':
        await handleDispute(event.data.object as Stripe.Dispute);
        break;
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await createAdminClient()
          .from('profiles')
          // Sellers only receive transfers, so "ready" means the transfers capability is active.
          .update({ stripe_connect_onboarded: account.capabilities?.transfers === 'active' })
          .eq('stripe_connect_account_id', account.id);
        break;
      }
    }
  } catch (e) {
    console.error(`Webhook ${event.type} ${event.id} failed`, e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return;
  const admin = createAdminClient();
  const { listing_id, buyer_id } = session.metadata ?? {};
  const paymentIntentId = session.payment_intent as string;
  const salePriceCents = session.amount_total ?? 0;

  const { data: outcome, error } = await admin.rpc('fulfill_checkout', {
    p_session_id: session.id,
    p_payment_intent_id: paymentIntentId,
    p_listing_id: listing_id,
    p_buyer_id: buyer_id,
    p_sale_price_cents: salePriceCents,
    p_commission_cents: calcCommissionCents(salePriceCents)
  });
  if (error) throw error;

  if (outcome === 'created') await recordPurchaseDetails(session.id, listing_id!);

  if (outcome === 'conflict') {
    // Paid for a saddle this session no longer held (reservation expired and someone else
    // bought it, or the buyer started a newer checkout). Refund in full and log for support.
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId, reason: 'duplicate', metadata: { checkout_session_id: session.id } },
      { idempotencyKey: `checkout-conflict-refund-${session.id}` }
    );
    await admin.from('payment_exceptions').upsert(
      {
        kind: 'checkout_conflict',
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        listing_id,
        buyer_id,
        detail: { refund_id: refund.id, refund_status: refund.status, amount: salePriceCents }
      },
      { onConflict: 'stripe_checkout_session_id,kind', ignoreDuplicates: true }
    );
    console.warn(`Checkout ${session.id} lost its reservation; refunded ${refund.id}`);
  }
}

/**
 * Freeze what the buyer bought (the listing can't be edited mid-sale, so this matches what they
 * saw), set the seller's dispatch deadline, and start the order's history. Never throws: the
 * order already exists, and these details must not make Stripe retry the payment event.
 */
async function recordPurchaseDetails(sessionId: string, listingId: string) {
  try {
    const admin = createAdminClient();
    const [{ data: order }, { data: listing }] = await Promise.all([
      admin.from('orders').select('id, created_at').eq('stripe_checkout_session_id', sessionId).single(),
      admin
        .from('listings')
        .select('id, slug, model, discipline, seat_size, tree_width, panel_type, panel_flocking, year_manufactured, condition, color, price_cents, description, images, location_city, location_state, location_zip, trial_policy, brands(name)')
        .eq('id', listingId)
        .single()
    ]);
    if (!order) return;
    const dispatchDue = addBusinessDays(new Date(order.created_at), DISPATCH_BUSINESS_DAYS);
    await admin
      .from('orders')
      .update({
        listing_snapshot: listing ?? null,
        terms_version: BUYER_TERMS_VERSION,
        fee_percent: COMMISSION_PERCENT,
        dispatch_due_at: dispatchDue.toISOString()
      })
      .eq('id', order.id);
    await logOrderEvent(order.id, 'paid', 'system', null, { dispatch_due_at: dispatchDue.toISOString() });
  } catch (e) {
    console.error(`Could not record purchase details for checkout ${sessionId}`, e);
  }
}

async function releaseReservation(session: Stripe.Checkout.Session) {
  const { error } = await createAdminClient().rpc('release_reservation', { p_session_id: session.id });
  if (error) throw error;
}

async function handleRefund(charge: Stripe.Charge) {
  if (!charge.refunded || !charge.payment_intent) return; // partial refunds: handled manually for now
  const admin = createAdminClient();
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;
  const { data: orders } = await admin.from('orders').update({ status: 'refunded' }).eq('stripe_payment_intent_id', pi).select('id');
  await voidRewardForRefund(pi);
  // Stop any payout that hasn't gone out. (A refund after payout needs a manual transfer reversal.)
  await admin
    .from('orders')
    .update({ payout_status: 'cancelled' })
    .eq('stripe_payment_intent_id', pi)
    .in('payout_status', ['held', 'on_hold']);
  for (const o of orders ?? []) await logOrderEvent(o.id, 'refunded', 'system', null, { amount: charge.amount_refunded });
}

async function handleDispute(dispute: Stripe.Dispute) {
  const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!pi) return;
  const admin = createAdminClient();
  await admin
    .from('orders')
    .update({ payout_status: 'disputed' })
    .eq('stripe_payment_intent_id', pi)
    .in('payout_status', ['held', 'on_hold']);
  const { data: orders } = await admin.from('orders').select('id').eq('stripe_payment_intent_id', pi);
  for (const o of orders ?? []) await logOrderEvent(o.id, 'disputed', 'system', null, { reason: dispute.reason });
}
