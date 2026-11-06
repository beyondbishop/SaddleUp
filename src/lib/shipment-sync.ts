// Turn carrier tracking into order progress. Always re-reads tracking from Shippo (never trusts a
// webhook body), and every step is safe to repeat:
//   first carrier scan  -> order "shipped" (a label alone never counts)
//   delivered           -> order delivered_at, once; the database starts the 120-hour inspection
//   failure / returned  -> pause the seller payout and open a SaddleUp review
import { createAdminClient } from '@/lib/supabase/server';
import { getTrack } from '@/lib/shippo';
import { logOrderEvent } from '@/lib/orders';

const STATUS_MAP: Record<string, string> = {
  UNKNOWN: 'unknown',
  PRE_TRANSIT: 'pre_transit',
  TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
  FAILURE: 'failure'
};

export async function syncShipment(shipmentId: string) {
  const admin = createAdminClient();
  const { data: s } = await admin
    .from('shipments')
    .select('id, order_id, direction, carrier, tracking_number, status, accepted_at, delivered_at')
    .eq('id', shipmentId)
    .maybeSingle();
  if (!s) return;

  const track = await getTrack(s.carrier, s.tracking_number);
  const status = STATUS_MAP[track.status] ?? 'unknown';
  const acceptedAt = s.accepted_at ?? track.firstTransitAt;
  const deliveredAt = s.delivered_at ?? track.deliveredAt;

  await admin
    .from('shipments')
    .update({
      // Once delivered, stay delivered even if the carrier later shows something odd.
      status: s.status === 'delivered' ? 'delivered' : status === 'unknown' && s.status !== 'unknown' ? s.status : status,
      accepted_at: acceptedAt,
      delivered_at: deliveredAt,
      last_checked_at: new Date().toISOString()
    })
    .eq('id', s.id);

  if (s.direction !== 'outbound') return; // returns are handled in slice 4

  if (acceptedAt) {
    const { data: shipped } = await admin
      .from('orders')
      .update({ shipped_at: acceptedAt })
      .eq('id', s.order_id)
      .is('shipped_at', null)
      .select('id')
      .maybeSingle();
    if (shipped) await logOrderEvent(s.order_id, 'shipped', 'system', null, { carrier: s.carrier, tracking_number: s.tracking_number });
  }

  if (deliveredAt) {
    // Only the first delivery counts; repeated scans never restart the clock.
    const { data: delivered } = await admin
      .from('orders')
      .update({ delivered_at: deliveredAt })
      .eq('id', s.order_id)
      .eq('status', 'paid')
      .is('delivered_at', null)
      .select('id, release_at')
      .maybeSingle();
    if (delivered) {
      await logOrderEvent(s.order_id, 'delivered', 'system', null, { delivered_at: deliveredAt, release_at: delivered.release_at });
    }
    return;
  }

  if (track.status === 'FAILURE' || track.status === 'RETURNED') {
    const { data: held } = await admin
      .from('orders')
      .update({
        payout_status: 'on_hold',
        issue_type: 'problem',
        issue_reason: 'delivery_exception',
        issue_details: `Carrier reported ${track.status.toLowerCase()} for ${s.carrier} ${s.tracking_number}.`,
        issue_opened_at: new Date().toISOString(),
        review_status: 'open'
      })
      .eq('id', s.order_id)
      .eq('payout_status', 'held')
      .is('issue_type', null)
      .select('id')
      .maybeSingle();
    if (held) await logOrderEvent(s.order_id, 'delivery_problem', 'system', null, { status: track.status });
  }
}

/** Daily backup for missed webhooks: re-check shipments still moving. */
export async function syncOpenShipments(limit = 100) {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data } = await admin
    .from('shipments')
    .select('id')
    .not('status', 'in', '(delivered,returned)')
    .or(`last_checked_at.is.null,last_checked_at.lt.${staleBefore}`)
    .limit(limit);
  let checked = 0;
  for (const s of data ?? []) {
    try {
      await syncShipment(s.id);
      checked++;
    } catch (e) {
      console.error(`Tracking check failed for shipment ${s.id}`, e);
    }
  }
  return checked;
}
