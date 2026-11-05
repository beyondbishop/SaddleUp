import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

// Buyer came back from Stripe without paying: close their checkout and free the saddle now,
// instead of holding it until the session times out.
export async function POST(req: Request) {
  const { listingId } = await req.json().catch(() => ({}));
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || typeof listingId !== 'string') return NextResponse.json({ ok: false });

  const admin = createAdminClient();
  const { data: res } = await admin
    .from('listing_reservations')
    .select('stripe_checkout_session_id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .maybeSingle();
  if (!res) return NextResponse.json({ ok: true });

  if (res.stripe_checkout_session_id) {
    try {
      await stripe.checkout.sessions.expire(res.stripe_checkout_session_id);
    } catch {
      // Already complete or expired. If complete, the webhook turns it into an order;
      // don't release the saddle out from under a paid checkout.
      const s = await stripe.checkout.sessions.retrieve(res.stripe_checkout_session_id).catch(() => null);
      if (s?.status === 'complete') return NextResponse.json({ ok: true });
    }
  }
  await admin.rpc('release_reservation', { p_listing_id: listingId, p_buyer_id: user.id });
  return NextResponse.json({ ok: true });
}
