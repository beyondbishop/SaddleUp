// POST /api/sales/<order id>/label { from: { name, street1, street2?, city, state, zip, phone } }
//   Seller buys the outbound label (SaddleUp's Shippo account pays; the buyer paid shipping at
//   checkout). Signature on delivery and insurance for the full sale price. One label per order.
// GET  /api/sales/<order id>/label   -> { url } for the label PDF (seller or admin only)
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { buyLabel, parcelFor, shippoConfigured, type Address } from '@/lib/shippo';
import { logOrderEvent } from '@/lib/orders';
import { isUuid } from '@/lib/lists-server';
import { getViewer } from '@/lib/roles';

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!shippoConfigured()) return err('Shipping labels are unavailable right now.', 503);
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return err('Please sign in.', 401);
  if (!isUuid(params.id)) return err('Order not found.', 404);

  const body = await req.json().catch(() => ({}));
  const f = body.from ?? {};
  const from: Address = {
    name: clean(f.name, 60),
    street1: clean(f.street1, 100),
    street2: clean(f.street2, 100) || null,
    city: clean(f.city, 60),
    state: clean(f.state, 2).toUpperCase(),
    zip: clean(f.zip, 10),
    phone: clean(f.phone, 20) || null
  };
  if (!from.name || !from.street1 || !from.city || !/^[A-Z]{2}$/.test(from.state) || !/^\d{5}(-\d{4})?$/.test(from.zip)) {
    return err('Fill in your full ship-from address.');
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, seller_id, status, sale_price_cents, ship_to, listing_snapshot, delivered_at, shipping_quote_id, shipping_quotes(service_token)')
    .eq('id', params.id)
    .maybeSingle();
  if (!order || order.seller_id !== user.id) return err('Order not found.', 404);
  if (order.status !== 'paid' || order.delivered_at) return err('This order can’t be shipped now.');
  const to = order.ship_to as Address | null;
  if (!to?.street1 || !to?.zip) return err('This order has no delivery address yet. Please contact SaddleUp.');

  const { data: existing } = await admin.from('shipments').select('id').eq('order_id', order.id).eq('direction', 'outbound').limit(1);
  if (existing?.length) return err('A label or tracking number already exists for this order.');

  let label;
  try {
    label = await buyLabel(
      from,
      to,
      parcelFor(order.listing_snapshot as any),
      order.sale_price_cents,
      (order as any).shipping_quotes?.service_token ?? null
    );
  } catch (e: any) {
    console.error(`Label purchase failed for order ${order.id}`, e);
    return err(`The label couldn’t be created: ${e?.message ?? 'carrier error'}`, 502);
  }

  const { error: insertError } = await admin.from('shipments').insert({
    order_id: order.id,
    direction: 'outbound',
    source: 'shippo_label',
    carrier: label.carrier,
    service_token: label.serviceToken,
    tracking_number: label.trackingNumber,
    tracking_url: label.trackingUrl,
    label_url: label.labelUrl,
    label_cost_cents: label.costCents,
    insured_cents: order.sale_price_cents,
    signature_required: true,
    shippo_shipment_id: label.shipmentId,
    shippo_transaction_id: label.transactionId,
    status: 'label_created'
  });
  if (insertError) {
    // The label exists at Shippo but we couldn't record it: flag loudly so it isn't bought twice.
    console.error(`LABEL BOUGHT BUT NOT RECORDED for order ${order.id}: ${label.transactionId}`, insertError);
    return err('The label was created but couldn’t be saved. Please contact SaddleUp before trying again.', 500);
  }

  // Remember the ship-from address for next time, and keep a copy on the order for tracking.
  await admin.from('profiles').update({ ship_from: from }).eq('id', user.id);
  await admin.from('orders').update({ carrier: label.carrier, tracking_number: label.trackingNumber }).eq('id', order.id);
  await logOrderEvent(order.id, 'label_created', 'seller', user.id, { carrier: label.carrier, tracking_number: label.trackingNumber, cost_cents: label.costCents });

  return NextResponse.json({ ok: true, labelUrl: label.labelUrl, trackingNumber: label.trackingNumber });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) return err('Please sign in.', 401);
  if (!isUuid(params.id)) return err('Order not found.', 404);
  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('seller_id').eq('id', params.id).maybeSingle();
  if (!order || (order.seller_id !== user.id && !isAdmin)) return err('Order not found.', 404);
  const { data: s } = await admin
    .from('shipments')
    .select('label_url')
    .eq('order_id', params.id)
    .eq('direction', 'outbound')
    .not('label_url', 'is', null)
    .maybeSingle();
  if (!s?.label_url) return err('No label for this order.', 404);
  return NextResponse.redirect(s.label_url);
}
