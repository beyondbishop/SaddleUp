import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { releasePayout } from '@/lib/payouts';
import { recordMissingRewards } from '@/lib/rewards';
import { syncOpenShipments } from '@/lib/shipment-sync';

// Daily: pay sellers whose buyer confirmed receipt or whose inspection window (which starts at
// confirmed delivery) has ended, and free saddles left reserved by abandoned checkouts.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Backup for missed checkout.session.expired webhooks.
  const { data: releasedReservations } = await admin.rpc('release_reservation', { p_grace: '1 hour' });

  const { data: dueOrders, error } = await admin
    .from('orders')
    .select('id')
    .eq('status', 'paid')
    .eq('payout_status', 'held')
    .or(`confirmed_at.not.is.null,release_at.lte.${new Date().toISOString()}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let released = 0;
  const failed: string[] = [];
  for (const order of dueOrders ?? []) {
    const result = await releasePayout(order.id, { byBuyer: false });
    if (result.ok) released++;
    else if (result.reason !== 'not_eligible') failed.push(order.id);
  }

  // Backup for missed tracking webhooks (runs before payouts on the next day's job too).
  const shipmentsChecked = await syncOpenShipments().catch((e) => {
    console.error('Tracking catch-up failed', e);
    return 0;
  });

  const rewardsRecorded = await recordMissingRewards().catch((e) => {
    console.error('Importer reward catch-up failed', e);
    return 0;
  });

  return NextResponse.json({
    shipmentsChecked,
    rewardsRecorded,
    checked: dueOrders?.length ?? 0,
    released,
    failed,
    releasedReservations: releasedReservations ?? 0
  });
}
