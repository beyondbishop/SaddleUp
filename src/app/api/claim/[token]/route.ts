// GET /api/claim/[token]  ->  { images: string[] }
// Photos for an unclaimed listing, so the claim page can show the seller their saddle.
// The claim token is the secret; once claimed (or for any other listing) this returns nothing.
//
// Also records that the claim link was opened, for the importer's "My imports" page. Only real
// visits count: the claim page calls this from the browser, so Messenger/Facebook link previews
// never reach it, and importers or admins opening the link themselves are skipped.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|fetch|curl|wget|python|headless|lighthouse/i;

async function recordOpen(listingId: string, req: Request) {
  try {
    const ua = req.headers.get('user-agent') ?? '';
    if (!ua || BOT.test(ua)) return;
    const { user, isImporter } = await getViewer();
    if (user && isImporter) return; // the importer (or an admin) checking the link

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from('listing_imports')
      .select('link_first_opened_at, link_open_count')
      .eq('listing_id', listingId)
      .maybeSingle();
    if (error || !row) return; // not an import, or the migration hasn't been run yet
    const now = new Date().toISOString();
    await admin
      .from('listing_imports')
      .update({
        link_first_opened_at: row.link_first_opened_at ?? now,
        link_last_opened_at: now,
        link_open_count: (row.link_open_count ?? 0) + 1
      })
      .eq('listing_id', listingId);
  } catch (e) {
    console.error('Could not record claim link open', e);
  }
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) return NextResponse.json({ images: [] });
  const { data } = await createAdminClient()
    .from('listings')
    .select('id, images')
    .eq('claim_token', params.token)
    .eq('status', 'unclaimed')
    .is('seller_id', null)
    .maybeSingle();
  if (data) await recordOpen(data.id, req);
  return NextResponse.json({ images: ((data?.images as string[] | null) ?? []).slice(0, 4) });
}
