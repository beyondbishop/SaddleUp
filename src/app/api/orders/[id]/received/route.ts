// POST /api/orders/<id>/received   buyer of a shipped order
// The buyer confirms the saddle arrived. Needed when the seller shipped with a carrier we can't
// track ("Other"); also allowed for tracked ones in case the carrier never reports delivery.
// It counts as delivery: the database starts the 5-day trial (release_at), once.
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
  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, status, fulfillment, shipped_at, delivered_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!order || order.buyer_id !== user.id) return err('Order not found.', 404);
  if (order.fulfillment === 'pickup') return err('This order is a local pickup.');
  if (order.status !== 'paid') return err('This order is closed.');
  if (order.delivered_at) return NextResponse.json({ ok: true, already: true });
  if (!order.shipped_at) return err('The seller hasn’t shipped this saddle yet.');

  const at = new Date().toISOString();
  const { data: updated } = await admin
    .from('orders')
    .update({ delivered_at: at })
    .eq('id', order.id)
    .eq('status', 'paid')
    .is('delivered_at', null)
    .select('id, release_at')
    .maybeSingle();
  if (!updated) return NextResponse.json({ ok: true, already: true });

  await logOrderEvent(order.id, 'delivered', 'buyer', user.id, { delivered_at: at, release_at: updated.release_at, confirmed_by: 'buyer' });
  return NextResponse.json({ ok: true, release_at: updated.release_at });
}
