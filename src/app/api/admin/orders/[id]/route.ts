// POST /api/admin/orders/<id>   admins only
//   { action: 'mark_delivered', deliveredAt? }   carrier shows delivered: starts the 120-hour inspection (once)
//   { action: 'resolve', outcome: 'release' | 'keep_hold', note }
//       release: close the review and let the payout follow the normal rules again
//       keep_hold: record a note, keep the payout paused (e.g. a refund is being arranged in Stripe)
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { logOrderEvent } from '@/lib/orders';
import { isUuid } from '@/lib/lists-server';

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) return err('Please sign in.', 401);
  if (!isAdmin) return err('Admins only.', 403);
  if (!isUuid(params.id)) return err('Order not found.', 404);

  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';

  if (body.action === 'mark_delivered') {
    const at = body.deliveredAt ? new Date(body.deliveredAt) : new Date();
    if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 60_000) return err('Enter the delivery time from the carrier.');
    // The database sets the inspection deadline from the first delivery only.
    const { data } = await admin
      .from('orders')
      .update({ delivered_at: at.toISOString() })
      .eq('id', params.id)
      .eq('status', 'paid')
      .is('delivered_at', null)
      .select('id, release_at')
      .maybeSingle();
    if (!data) return err('Already marked delivered, or the order is closed.');
    await logOrderEvent(data.id, 'delivered', 'admin', user.id, { delivered_at: at.toISOString(), release_at: data.release_at });
    return NextResponse.json({ ok: true, release_at: data.release_at });
  }

  if (body.action === 'resolve') {
    if (body.outcome !== 'release' && body.outcome !== 'keep_hold') return err('Choose an outcome.');
    if (!note) return err('Add a short note about what was decided.');
    const changes =
      body.outcome === 'release'
        ? { review_status: 'resolved', review_note: note, payout_status: 'held' }
        : { review_note: note };
    let q = admin.from('orders').update(changes).eq('id', params.id).eq('review_status', 'open');
    if (body.outcome === 'release') q = q.eq('payout_status', 'on_hold');
    const { data } = await q.select('id').maybeSingle();
    if (!data) return err('This review is no longer open.');
    await logOrderEvent(data.id, body.outcome === 'release' ? 'review_resolved' : 'review_note', 'admin', user.id, { outcome: body.outcome, note });
    return NextResponse.json({ ok: true });
  }

  return err('Unknown action.');
}
