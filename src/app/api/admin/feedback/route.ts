// POST /api/admin/feedback  { listingId: string, message: string }
// Sends the listing's seller a message from the review team. It lands in the seller's
// Messages inbox as a conversation about that listing (admin as the other participant).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const { listingId, message } = (await req.json().catch(() => ({}))) as { listingId?: string; message?: string };
  const text = message?.trim();
  if (!listingId || !text) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: 'That message is too long.' }, { status: 400 });

  const { data: listing } = await supabase.from('listings').select('id, seller_id').eq('id', listingId).single();
  if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  if (!listing.seller_id) {
    return NextResponse.json({ error: "This listing hasn't been claimed yet, so there's no seller to message." }, { status: 400 });
  }
  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: "That's your own listing." }, { status: 400 });
  }

  // One review conversation per listing; reuse it for follow-ups.
  let { data: convo } = await supabase
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .maybeSingle();
  if (!convo) {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ listing_id: listingId, buyer_id: user.id, seller_id: listing.seller_id })
      .select('id')
      .single();
    if (error || !created) {
      console.error('Feedback conversation failed', error);
      return NextResponse.json({ error: `Couldn't start the conversation: ${error?.message}` }, { status: 400 });
    }
    convo = created;
  }

  const { error: msgError } = await supabase
    .from('messages')
    .insert({ conversation_id: convo.id, sender_id: user.id, body: `From the SaddleUp review team:\n\n${text}` });
  if (msgError) {
    console.error('Feedback message failed', msgError);
    return NextResponse.json({ error: `Couldn't send: ${msgError.message}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true, conversationId: convo.id });
}
