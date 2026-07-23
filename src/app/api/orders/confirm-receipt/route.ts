import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

// Called from the buyer's order page: "Confirm Receipt" button.
// Releases the seller's payout immediately instead of waiting for the
// automatic 5-day trial window to elapse.
export async function POST(req: Request) {
  const { orderId } = await req.json();
  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  if (order.payout_status !== 'held') {
    return NextResponse.json({ error: 'This order has already been settled.' }, { status: 400 });
  }

  const { data: seller } = await admin
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', order.seller_id)
    .single();

  if (!seller?.stripe_connect_account_id) {
    return NextResponse.json({ error: 'Seller payout account not found.' }, { status: 400 });
  }

  const transfer = await stripe.transfers.create({
    amount: order.seller_payout_cents,
    currency: 'usd',
    destination: seller.stripe_connect_account_id,
    transfer_group: order.id
  });

  await admin
    .from('orders')
    .update({
      payout_status: 'transferred',
      confirmed_at: new Date().toISOString(),
      stripe_transfer_id: transfer.id
    })
    .eq('id', order.id);

  return NextResponse.json({ ok: true });
}
