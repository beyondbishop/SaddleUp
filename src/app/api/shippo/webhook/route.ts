// POST /api/shippo/webhook?token=<SHIPPO_WEBHOOK_TOKEN>
// Shippo calls this when tracking changes. We don't trust the body: it only tells us which
// shipment to re-check, and syncShipment() reads the real status back from Shippo.
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { syncShipment } from '@/lib/shipment-sync';

export const runtime = 'nodejs';

function tokenOk(given: string | null) {
  const expected = process.env.SHIPPO_WEBHOOK_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!tokenOk(new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const data = body?.data ?? {};
  const tracking = typeof data.tracking_number === 'string' ? data.tracking_number : null;
  if (body?.event !== 'track_updated' || !tracking) return NextResponse.json({ ignored: true });

  const { data: shipments } = await createAdminClient()
    .from('shipments')
    .select('id')
    .eq('tracking_number', tracking)
    .limit(5);
  for (const s of shipments ?? []) {
    try {
      await syncShipment(s.id);
    } catch (e) {
      console.error(`Tracking sync failed for shipment ${s.id}`, e);
      return NextResponse.json({ error: 'Retry later' }, { status: 500 }); // Shippo retries
    }
  }
  return NextResponse.json({ received: true, matched: shipments?.length ?? 0 });
}
