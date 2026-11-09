// POST /api/reviews  { orderId, rating, comment?, shareOk }
// The signed-in buyer or seller of a finished sale rates it. Buyers rate the seller and the
// experience; sellers rate SaddleUp. Saving again updates their review.
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/lists-server';
import { saddleLabel, saleIsFinal } from '@/lib/reviews';

export async function POST(req: Request) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rating = Number(body.rating);
  if (!isUuid(body.orderId)) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'Choose 1 to 5 stars.' }, { status: 400 });
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) : '';

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, payout_status, confirmed_at, kept_at, listing_snapshot')
    .eq('id', body.orderId)
    .maybeSingle();
  const role = order?.buyer_id === user.id ? 'buyer' : order?.seller_id === user.id ? 'seller' : null;
  if (!order || !role) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (!saleIsFinal(order)) return NextResponse.json({ error: 'You can rate it once the sale is final.' }, { status: 400 });

  const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const { error } = await admin.from('reviews').upsert(
    {
      order_id: order.id,
      reviewer_id: user.id,
      reviewer_role: role,
      // Buyers review the seller; a seller's review is of SaddleUp itself.
      reviewee_id: role === 'buyer' ? order.seller_id : null,
      rating,
      comment: comment || null,
      share_ok: body.shareOk === true,
      reviewer_first_name: profile?.full_name?.trim().split(/\s+/)[0] ?? null,
      saddle_label: saddleLabel(order.listing_snapshot)
    },
    { onConflict: 'order_id,reviewer_role' }
  );
  if (error) {
    console.error('Review save failed', error);
    return NextResponse.json({ error: 'Could not save your review. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, role });
}
