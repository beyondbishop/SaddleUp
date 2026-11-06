// POST /api/orders/<id>/actions  (buyer only)
//   { action: 'keep' }                                     approve: pay the seller now
//   { action: 'return_request', reason, details }          during the inspection window
//   { action: 'problem', reason, details }                 before delivery or during inspection
// A return request or problem pauses the seller's payout and opens a SaddleUp review.
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { releasePayout } from '@/lib/payouts';
import { ISSUE_REASONS, logOrderEvent } from '@/lib/orders';
import { isUuid } from '@/lib/lists-server';

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return err('Please sign in.', 401);
  if (!isUuid(params.id)) return err('Order not found.', 404);

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, status, payout_status, delivered_at, release_at, issue_type')
    .eq('id', params.id)
    .maybeSingle();
  if (!order || order.buyer_id !== user.id) return err('Order not found.', 404);
  if (order.status !== 'paid') return err('This order is closed.');

  const body = await req.json().catch(() => ({}));
  const now = Date.now();
  const inspectionOpen = !!order.delivered_at && !!order.release_at && now < new Date(order.release_at).getTime();
  const windowClosed = !!order.release_at && now >= new Date(order.release_at).getTime();

  if (body.action === 'keep') {
    const result = await releasePayout(order.id, { byBuyer: true });
    if (!result.ok && result.reason === 'not_eligible') return err('This order has already been settled or is under review.');
    await admin.from('orders').update({ kept_at: new Date().toISOString() }).eq('id', order.id).is('kept_at', null);
    await logOrderEvent(order.id, 'kept', 'buyer', user.id);
    return NextResponse.json({ ok: true, pending: !result.ok });
  }

  if (body.action !== 'return_request' && body.action !== 'problem') return err('Unknown action.');
  const type = body.action as 'return_request' | 'problem';
  const reasons = ISSUE_REASONS[type] as Record<string, string>;
  if (typeof body.reason !== 'string' || !(body.reason in reasons)) return err('Choose a reason.');
  const details = typeof body.details === 'string' ? body.details.trim().slice(0, 4000) : '';
  if (!details) return err('Tell us a little about what happened.');

  // Timing rules, enforced here rather than trusted from the page.
  if (type === 'return_request' && !inspectionOpen) {
    return err(order.delivered_at ? 'The 5-day inspection window has ended.' : 'You can request a return once the saddle is delivered.');
  }
  if (type === 'problem' && windowClosed) return err('The 5-day inspection window has ended. Please contact SaddleUp.');
  if (order.issue_type) return err('You’ve already told us about a problem with this order. We’ll be in touch.');

  // Pause the payout only if it hasn't started; one open issue per order.
  const { data: updated } = await admin
    .from('orders')
    .update({
      payout_status: 'on_hold',
      issue_type: type,
      issue_reason: body.reason,
      issue_details: details,
      issue_opened_at: new Date().toISOString(),
      review_status: 'open'
    })
    .eq('id', order.id)
    .eq('payout_status', 'held')
    .is('issue_type', null)
    .select('id')
    .maybeSingle();
  if (!updated) return err('This order has already been settled. Please contact SaddleUp.');

  await logOrderEvent(order.id, type === 'return_request' ? 'return_requested' : 'problem_reported', 'buyer', user.id, {
    reason: body.reason
  });
  return NextResponse.json({ ok: true });
}
