import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { releasePayout } from '@/lib/payouts';

// Called from the buyer's order page: "Confirm Receipt" button.
// Releases the seller's payout now instead of waiting for the inspection window to end.
export async function POST(req: Request) {
  const { orderId } = await req.json().catch(() => ({}));
  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: order } = await admin.from('orders').select('id, buyer_id').eq('id', orderId).single();
  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const result = await releasePayout(order.id, { byBuyer: true });
  if (result.ok) return NextResponse.json({ ok: true });
  if (result.reason === 'not_eligible') {
    return NextResponse.json({ error: 'This order has already been settled or is under review.' }, { status: 400 });
  }
  // Receipt is recorded; the daily job retries the transfer.
  return NextResponse.json({ ok: true, pending: true });
}
