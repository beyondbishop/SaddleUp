// GET /api/lists/saved   ids of saddles on any of the buyer's active lists (drives the hearts)
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/lists-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ signedIn: false, listingIds: [] });
  const { data } = await supabase
    .from('buyer_list_items')
    .select('listing_id, buyer_lists!inner(archived_at)')
    .is('buyer_lists.archived_at', null);
  return NextResponse.json({ signedIn: true, listingIds: [...new Set((data ?? []).map((r) => r.listing_id))] });
}
