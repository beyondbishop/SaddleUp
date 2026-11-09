// POST /api/orders/<id>/pickup   buyer or seller of a local-pickup order
// Records that the saddle was handed over in person. That's the pickup version of "delivered":
// the database starts the 5-day trial (release_at = handover + 120 hours), and the payout then
// follows the normal rules (buyer keeps it, or the trial ends). Either side can confirm; the
// first confirmation counts and later ones change nothing.
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { logOrderEvent } from '@/lib/orders';
import { isUuid } from '@/lib/lists-server';

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return err('Please sign in.', 401);
  if (!isUuid(params.id)) return err('Order not found.', 404);

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('*').eq('id', params.id).maybeSingle();
  const role = order?.buyer_id === user.id ? 'buyer' : order?.seller_id === user.id ? 'seller' : null;
  if (!order || !role) return err('Order not found.', 404);
  if (order.fulfillment !== 'pickup') return err('This order is being shipped, not picked up.');
  if (order.status !== 'paid') return err('This order is closed.');
  if (order.delivered_at) return NextResponse.json({ ok: true, already: true });

  const at = new Date().toISOString();
  const { data: updated } = await admin
    .from('orders')
    .update({ shipped_at: order.shipped_at ?? at, delivered_at: at })
    .eq('id', order.id)
    .eq('status', 'paid')
    .is('delivered_at', null)
    .select('id, release_at')
    .maybeSingle();
  if (!updated) return NextResponse.json({ ok: true, already: true });

  await logOrderEvent(order.id, 'picked_up', role, user.id, { delivered_at: at, release_at: updated.release_at });
  return NextResponse.json({ ok: true, release_at: updated.release_at });
}
