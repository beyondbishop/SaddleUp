// POST /api/admin/listings/<id>/status  { choice: 'live' | 'draft' | 'removed' | 'unclaimed_shown' | 'unclaimed_hidden' }
// Admins only: change where a listing stands (put it back, send to draft, take it down, show or
// hide an unclaimed import). Sold and mid-checkout saddles can't be changed here.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';
import { allowedChoices, updateFor, type StatusChoice } from '@/lib/listing-status';
import { listingPaths, notifyIndexNow } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user || !isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const choice = body.choice as StatusChoice;
  const admin = createAdminClient();
  const { data: listing } = await admin.from('listings').select('id, status, seller_id, show_before_claim').eq('id', params.id).maybeSingle();
  if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  if (!allowedChoices(listing).includes(choice)) {
    return NextResponse.json(
      { error: listing.status === 'sold' || listing.status === 'pending_sale' ? 'This saddle has a sale, so its status can’t be changed here.' : 'That status isn’t available for this listing.' },
      { status: 400 }
    );
  }

  const { data: saved, error } = await admin
    .from('listings')
    .update(updateFor(choice))
    .eq('id', listing.id)
    // Don't overwrite a sale that started a moment ago.
    .not('status', 'in', '(sold,pending_sale)')
    .select('slug, discipline, brands(slug)')
    .maybeSingle();
  if (error || !saved) {
    console.error('Listing status change failed', error);
    return NextResponse.json({ error: 'Could not change the status. Please try again.' }, { status: 400 });
  }
  // Coming back or going away: ask search engines to re-check the page.
  await notifyIndexNow(listingPaths(saved as any)).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
