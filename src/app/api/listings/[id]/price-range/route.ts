// POST /api/listings/:id/price-range
// Works out (or reuses) the listing's fair price range and saves it for the public saddle page.
// Called by the listing form right after a save. Only the listing's seller, admins and importers
// may trigger it, since a fresh check costs money; the range itself is always computed here on
// the server from the saved listing, never taken from the browser.

import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/server';
import { aiReaderConfigured } from '@/lib/ai-parse-listing';
import { refreshListingPriceRange } from '@/lib/listing-price-range';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { user, isImporter } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!aiReaderConfigured()) return NextResponse.json({ range: null });

  const admin = createAdminClient();
  const { data: listing } = await admin.from('listings').select('id, seller_id').eq('id', params.id).maybeSingle();
  if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  if (listing.seller_id !== user.id && !isImporter) return NextResponse.json({ error: 'Not your listing.' }, { status: 403 });

  const range = await refreshListingPriceRange(listing.id);
  return NextResponse.json({ range });
}
