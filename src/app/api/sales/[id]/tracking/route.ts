// POST /api/sales/<order id>/tracking { carrier, trackingNumber }   seller only
// Records that the saddle has been handed to the carrier (manual until Shippo labels are live).
// This doesn't start the inspection clock; confirmed delivery does.
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { logOrderEvent } from '@/lib/orders';
import { isUuid } from '@/lib/lists-server';

const CARRIERS = ['UPS', 'FedEx', 'USPS', 'DHL', 'Other'];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const carrier = CARRIERS.includes(body.carrier) ? body.carrier : null;
  const tracking = typeof body.trackingNumber === 'string' ? body.trackingNumber.replace(/\s+/g, '').slice(0, 60) : '';
  if (!carrier || tracking.length < 6) {
    return NextResponse.json({ error: 'Choose the carrier and enter the full tracking number.' }, { status: 400 });
  }

  const { data: order } = await createAdminClient()
    .from('orders')
    .update({ carrier, tracking_number: tracking, shipped_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('seller_id', user.id)
    .eq('status', 'paid')
    .is('delivered_at', null)
    .select('id, shipped_at')
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'This order can’t be updated.' }, { status: 400 });

  await logOrderEvent(order.id, 'shipped', 'seller', user.id, { carrier, tracking_number: tracking });
  return NextResponse.json({ ok: true });
}
