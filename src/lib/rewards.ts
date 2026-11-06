// Importer rewards. When a saddle someone imported sells and the sale is final (the seller has
// been paid, meaning the buyer kept it), the importer earns REWARD_PERCENT of what SaddleUp
// actually kept: our fee minus Stripe's real processing fee for that payment.
//
// Safe to call repeatedly for the same order: one reward per order (database primary key).
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';

export const REWARD_PERCENT = Number(process.env.IMPORTER_REWARD_PERCENT ?? 25);

/** Stripe's fee for the buyer's payment, in cents. */
async function processingFeeCents(paymentIntentId: string): Promise<number> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge.balance_transaction'] });
  const charge = pi.latest_charge as any;
  const bt = charge?.balance_transaction;
  if (bt && typeof bt === 'object' && typeof bt.fee === 'number') return bt.fee;
  throw new Error(`No processing fee available yet for ${paymentIntentId}`);
}

export function rewardFor(platformFeeCents: number, processingFee: number, percent = REWARD_PERCENT) {
  const net = Math.max(0, platformFeeCents - processingFee);
  return { net, amount: Math.floor((net * percent) / 100) };
}

export type RewardOutcome = 'created' | 'exists' | 'not_imported' | 'not_final' | 'void';

export async function recordImporterReward(orderId: string): Promise<RewardOutcome> {
  const admin = createAdminClient();

  const { data: existing } = await admin.from('importer_rewards').select('order_id').eq('order_id', orderId).maybeSingle();
  if (existing) return 'exists';

  const { data: order } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, seller_id, sale_price_cents, commission_cents, stripe_payment_intent_id, status, payout_status')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.status !== 'paid' || order.payout_status !== 'transferred') return 'not_final';

  const { data: imp } = await admin.from('listing_imports').select('importer_id').eq('listing_id', order.listing_id).maybeSingle();
  if (!imp) return 'not_imported';

  // No reward when the importer is the seller or the buyer of the saddle.
  const selfDealing =
    imp.importer_id === order.seller_id ? 'Importer is the seller' : imp.importer_id === order.buyer_id ? 'Importer is the buyer' : null;

  const fee = order.stripe_payment_intent_id ? await processingFeeCents(order.stripe_payment_intent_id) : 0;
  const { net, amount } = rewardFor(order.commission_cents, fee);

  const { error } = await admin.from('importer_rewards').insert({
    order_id: order.id,
    importer_id: imp.importer_id,
    listing_id: order.listing_id,
    sale_price_cents: order.sale_price_cents,
    platform_fee_cents: order.commission_cents,
    processing_fee_cents: fee,
    net_cents: net,
    reward_percent: REWARD_PERCENT,
    amount_cents: selfDealing ? 0 : amount,
    status: selfDealing ? 'void' : 'earned',
    void_reason: selfDealing
  });
  if (error) {
    if (error.code === '23505') return 'exists';
    throw error;
  }
  return selfDealing ? 'void' : 'created';
}

/** A sale was refunded: cancel an unpaid reward, or flag a paid one for you to sort out. */
export async function voidRewardForRefund(paymentIntentId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
  if (!order) return;
  await admin
    .from('importer_rewards')
    .update({ status: 'void', void_reason: 'Sale refunded' })
    .eq('order_id', order.id)
    .eq('status', 'earned');
  await admin
    .from('importer_rewards')
    .update({ needs_review: true, void_reason: 'Sale refunded after the reward was paid' })
    .eq('order_id', order.id)
    .eq('status', 'paid');
}

/**
 * Daily catch-up: any final sale from the last 90 days without a reward record gets one.
 * Covers rewards that couldn't be recorded at payout time (e.g. Stripe briefly unavailable).
 */
export async function recordMissingRewards() {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: orders } = await admin
    .from('orders')
    .select('id, listing_id')
    .eq('status', 'paid')
    .eq('payout_status', 'transferred')
    .gte('created_at', since)
    .limit(1000);
  if (!orders?.length) return 0;
  const [{ data: imports }, { data: rewards }] = await Promise.all([
    admin.from('listing_imports').select('listing_id').in('listing_id', orders.map((o) => o.listing_id)),
    admin.from('importer_rewards').select('order_id').in('order_id', orders.map((o) => o.id))
  ]);
  const imported = new Set((imports ?? []).map((i) => i.listing_id));
  const done = new Set((rewards ?? []).map((r) => r.order_id));
  let created = 0;
  for (const o of orders) {
    if (!imported.has(o.listing_id) || done.has(o.id)) continue;
    try {
      if ((await recordImporterReward(o.id)) === 'created') created++;
    } catch (e) {
      console.error(`Could not record importer reward for order ${o.id}`, e);
    }
  }
  return created;
}
