// GET /api/claim/[token]  ->  { images: string[], slug: string | null, isPublic: boolean, viewerIsImporter: boolean }
// Photos for an unclaimed listing, so the claim page can show the seller their saddle, plus its
// page address when shoppers can already see it (for the "See your listing" link). viewerIsImporter
// lets the page show importers a preview instead of a claim button they'd claim into their own account.
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

async function recordOpen(listingId: string, req: Request, viewerIsImporter: boolean) {
  try {
    const ua = req.headers.get('user-agent') ?? '';
    if (!ua || BOT.test(ua)) return;
    if (viewerIsImporter) return; // the importer (or an admin) checking the link

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

/**
 * POST /api/claim/[token]  { action: 'remove' }
 * The seller takes their unclaimed listing off SaddleUp themselves, straight from the link in
 * our message. No account needed: the claim token is the proof it's theirs (same as claiming).
 * Only works while the listing is still unclaimed; afterwards they manage it from their dashboard.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (body.action !== 'remove') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) return NextResponse.json({ error: 'This link isn’t valid.' }, { status: 404 });

  const admin = createAdminClient();
  const { data: claim } = await admin.from('listing_claim_tokens').select('listing_id').eq('token', params.token).maybeSingle();
  if (!claim) return NextResponse.json({ error: 'This link isn’t valid.' }, { status: 404 });

  const { data: removed, error } = await admin
    .from('listings')
    .update({ status: 'removed' })
    .eq('id', claim.listing_id)
    .eq('status', 'unclaimed')
    .is('seller_id', null)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('Seller removal failed', error);
    return NextResponse.json({ error: 'Couldn’t remove it just now. Please try again.' }, { status: 500 });
  }
  if (!removed) return NextResponse.json({ error: 'This listing has already been claimed or removed.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const empty = { images: [], slug: null, isPublic: false, viewerIsImporter: false };
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) return NextResponse.json(empty);
  const admin = createAdminClient();
  const { data: claim } = await admin.from('listing_claim_tokens').select('listing_id').eq('token', params.token).maybeSingle();
  const { data } = claim
    ? await admin
        .from('listings')
        .select('id, images, slug, show_before_claim')
        .eq('id', claim.listing_id)
        .eq('status', 'unclaimed')
        .is('seller_id', null)
        .maybeSingle()
    : { data: null };
  if (!data) return NextResponse.json(empty);
  const { user, isImporter } = await getViewer();
  const viewerIsImporter = !!user && isImporter;
  await recordOpen(data.id, req, viewerIsImporter);
  return NextResponse.json({
    images: ((data.images as string[] | null) ?? []).slice(0, 4),
    slug: data.slug ?? null,
    isPublic: !!data.show_before_claim,
    viewerIsImporter
  });
}
