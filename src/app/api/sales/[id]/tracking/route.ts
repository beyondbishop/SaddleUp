// POST /api/sales/<order id>/tracking { carrier, carrierName?, trackingNumber }   seller only
// Records that the seller shipped the saddle themselves (their own label, any carrier).
// This doesn't start the inspection clock; confirmed delivery does. USPS, UPS, FedEx and DHL are
// tracked automatically. "Other" (carrierName) can't be tracked, so the buyer confirms receipt.
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { logOrderEvent } from '@/lib/orders';
import { isUuid } from '@/lib/lists-server';
import { carrierCode, registerTrack, shippoConfigured } from '@/lib/shippo';
import { syncShipment } from '@/lib/shipment-sync';

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL'];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const otherName = typeof body.carrierName === 'string' ? body.carrierName.trim().replace(/\s+/g, ' ').slice(0, 40) : '';
  const carrier = CARRIERS.includes(body.carrier) ? body.carrier : body.carrier === 'Other' && otherName.length >= 2 ? otherName : null;
  const tracking = typeof body.trackingNumber === 'string' ? body.trackingNumber.replace(/\s+/g, '').slice(0, 60) : '';
  if (!carrier || tracking.length < 4) {
    return NextResponse.json({ error: body.carrier === 'Other' && !otherName ? 'Enter the carrier’s name.' : 'Choose the carrier and enter the full tracking number.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existingShipments } = await admin
    .from('shipments')
    .select('id, source')
    .eq('order_id', params.id)
    .eq('direction', 'outbound');
  if (existingShipments?.some((s) => s.source === 'shippo_label')) {
    return NextResponse.json({ error: 'This order already has a SaddleUp shipping label.' }, { status: 400 });
  }

  const { data: order } = await admin
    .from('orders')
    .update({ carrier, tracking_number: tracking, shipped_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('seller_id', user.id)
    .eq('status', 'paid')
    .is('delivered_at', null)
    .select('id, shipped_at')
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'This order can’t be updated.' }, { status: 400 });

  // Track it automatically. Shippo test mode only understands its fake SHIPPO_* numbers.
  const code = /^SHIPPO_/i.test(tracking) && process.env.SHIPPO_API_TOKEN?.startsWith('shippo_live') !== true
    ? 'shippo'
    : CARRIERS.includes(carrier) ? carrierCode(carrier) : null;
  const manual = existingShipments?.find((s) => s.source === 'manual');
  if (!code && manual) {
    // Switched to a carrier we can't track: stop following the old number.
    await admin.from('shipments').delete().eq('id', manual.id);
  }
  if (code) {
    const row = { order_id: order.id, direction: 'outbound', source: 'manual', carrier: code, tracking_number: tracking.toUpperCase().startsWith('SHIPPO_') ? tracking.toUpperCase() : tracking, status: 'pre_transit' };
    const { data: saved, error } = manual
      ? await admin.from('shipments').update({ ...row, accepted_at: null, last_checked_at: null }).eq('id', manual.id).select('id').single()
      : await admin.from('shipments').insert(row).select('id').single();
    if (error) {
      return NextResponse.json({ error: error.code === '23505' ? 'That tracking number is already used on another order.' : 'Could not save tracking.' }, { status: 400 });
    }
    if (shippoConfigured()) {
      try {
        await registerTrack(code, row.tracking_number, order.id);
        await syncShipment(saved.id);
      } catch (e) {
        console.error(`Could not start tracking for order ${order.id}`, e); // the daily check retries
      }
    }
  }

  await logOrderEvent(order.id, 'shipped', 'seller', user.id, { carrier, tracking_number: tracking });
  return NextResponse.json({ ok: true });
}
