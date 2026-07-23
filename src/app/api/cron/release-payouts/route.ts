import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: dueOrders } = await admin
    .from('orders')
    .select('*, profiles!orders_seller_id_fkey(stripe_connect_account_id)')
    .eq('payout_status', 'held')
    .lte('release_at', new Date().toISOString());

  let released = 0;
  for (const order of dueOrders ?? []) {
    const sellerAccount = (order as any).profiles?.stripe_connect_account_id;
    if (!sellerAccount) continue;

    try {
      const transfer = await stripe.transfers.create({
        amount: order.seller_payout_cents,
        currency: 'usd',
        destination: sellerAccount,
        transfer_group: order.id
      });

      await admin
        .from('orders')
        .update({ payout_status: 'transferred', stripe_transfer_id: transfer.id })
        .eq('id', order.id);

      released++;
    } catch (e) {
      console.error(`Failed to release payout for order ${order.id}`, e);
    }
  }

  return NextResponse.json({ checked: dueOrders?.length ?? 0, released });
}
