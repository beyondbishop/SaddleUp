import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { recordImporterReward } from '@/lib/rewards';
import { logOrderEvent } from '@/lib/orders';

export type PayoutResult =
  | { ok: true; transferId: string }
  | { ok: false; reason: 'not_eligible' | 'no_payout_account' | 'transfer_failed'; message?: string };

/**
 * Pay the seller for one order, at most once.
 *
 * 1. Atomically claim the order (held -> releasing) so a buyer confirmation and the daily job
 *    can't both pay it.
 * 2. Reuse any transfer already made for this order (transfer_group = order id), so a retry after
 *    a crash or timeout never pays twice; otherwise create one with an idempotency key.
 * 3. On failure, put the order back to held with the error, so the daily job retries it.
 */
export async function releasePayout(orderId: string, opts: { byBuyer: boolean }): Promise<PayoutResult> {
  const admin = createAdminClient();

  const { data: claimed, error: claimError } = await admin.rpc('claim_payout', {
    p_order_id: orderId,
    p_by_buyer: opts.byBuyer
  });
  if (claimError) throw claimError;
  const order = (claimed as any[] | null)?.[0];
  if (!order) return { ok: false, reason: 'not_eligible' };
  if (!opts.byBuyer && !order.confirmed_at && !order.kept_at) {
    await logOrderEvent(orderId, 'inspection_expired', 'system');
  }

  const fail = async (reason: 'no_payout_account' | 'transfer_failed', message: string) => {
    await admin
      .from('orders')
      .update({ payout_status: 'held', payout_error: message })
      .eq('id', orderId)
      .eq('payout_status', 'releasing');
    await logOrderEvent(orderId, 'payout_failed', 'system', null, { reason });
    return { ok: false as const, reason, message };
  };

  const { data: seller } = await admin
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', order.seller_id)
    .single();
  if (!seller?.stripe_connect_account_id) {
    return fail('no_payout_account', 'Seller has no Stripe payout account.');
  }

  try {
    let transfer: Stripe.Transfer | undefined = (
      await stripe.transfers.list({ transfer_group: order.id, limit: 1 })
    ).data[0];

    if (!transfer) {
      // Tie the transfer to the buyer's charge so it can be paid before those funds settle.
      const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
      transfer = await stripe.transfers.create(
        {
          amount: order.seller_payout_cents,
          currency: 'usd',
          destination: seller.stripe_connect_account_id,
          transfer_group: order.id,
          ...(chargeId ? { source_transaction: chargeId } : {}),
          metadata: { order_id: order.id }
        },
        { idempotencyKey: `payout-${order.id}` }
      );
    }

    await admin
      .from('orders')
      .update({ payout_status: 'transferred', stripe_transfer_id: transfer.id, payout_error: null })
      .eq('id', orderId);
    await logOrderEvent(orderId, 'payout_sent', 'system', null, { transfer_id: transfer.id, amount: order.seller_payout_cents });
    // The sale is final: credit whoever imported the saddle. Never let this block a payout;
    // the daily job records anything missed here.
    await recordImporterReward(orderId).catch((e) => console.error(`Importer reward not recorded for ${orderId}`, e));
    return { ok: true, transferId: transfer.id };
  } catch (e: any) {
    console.error(`Payout failed for order ${orderId}`, e);
    return fail('transfer_failed', e?.message ?? 'Unknown Stripe error');
  }
}
