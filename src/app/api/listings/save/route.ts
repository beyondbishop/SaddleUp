// POST /api/listings/save  { mode: 'create' | 'update' | 'seed', id?: string, listing: {...} }
// Saves a listing on the server with the signed-in user's session. Row-level security still
// decides what's allowed: sellers create/update their own listings; admins can seed hidden
// 'unclaimed' listings with no seller. (Saving from the browser could hang while the browser
// Supabase client waited on its auth lock, leaving the form stuck on "Saving…".)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listingPaths, notifyIndexNow } from '@/lib/indexnow';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { sourceKey } from '@/lib/import-source';
import { sendListingEmail } from '@/lib/listing-emails';
import { listingAccess } from '@/lib/listing-access';

// Importers (not admins) may add this many hidden listings per day. Keeps outreach personal
// and protects importers' Facebook accounts from looking like spam.
const IMPORTER_DAILY_LIMIT = 40;

/**
 * Quick add: create a claimable listing (public, messages go to SaddleUp) and record who imported it. Runs with the
 * service key after checking the caller may import (admins and importers).
 */
async function seedImport(values: Record<string, unknown>, userId: string, meta: { sourceUrl?: unknown; sellerName?: unknown } | undefined) {
  const fail = (message: string, code = '') => ({ data: null, error: { message, code } });
  const { isAdmin, isImporter } = await getViewer();
  if (!isImporter) return fail("You don't have permission to add saddles for other sellers.", '42501');

  const admin = createAdminClient();
  if (!isAdmin) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin
      .from('listing_imports')
      .select('listing_id', { count: 'exact', head: true })
      .eq('importer_id', userId)
      .gte('created_at', since);
    if ((count ?? 0) >= IMPORTER_DAILY_LIMIT) {
      return fail(`You've added ${IMPORTER_DAILY_LIMIT} saddles in the last 24 hours. Please message those sellers, then add more tomorrow.`, 'LIMIT');
    }
  }

  const key = sourceKey(meta?.sourceUrl);
  if (key) {
    const { data: dupe } = await admin.from('listing_imports').select('listing_id').eq('source_key', key).maybeSingle();
    if (dupe) return fail('That post has already been added to SaddleUp by someone.', 'DUPLICATE');
  }

  const { data: listing, error } = await admin
    .from('listings')
    .insert({ ...values, seller_id: null, created_by: userId, status: 'unclaimed', source: 'seeded', show_before_claim: true })
    .select('id')
    .single();
  if (error || !listing) return { data: null, error };

  // The claim link's secret lives in its own private table (listings are public; the token isn't).
  const { data: claim, error: tokenError } = await admin
    .from('listing_claim_tokens')
    .insert({ listing_id: listing.id })
    .select('token')
    .single();
  if (tokenError || !claim) {
    await admin.from('listings').delete().eq('id', listing.id);
    return fail("Couldn't create the claim link.", tokenError?.code);
  }

  const { error: importError } = await admin.from('listing_imports').insert({
    listing_id: listing.id,
    importer_id: userId,
    source_url: typeof meta?.sourceUrl === 'string' && meta.sourceUrl.trim()
      ? (/^https?:\/\//i.test(meta.sourceUrl.trim()) ? meta.sourceUrl.trim() : `https://${meta.sourceUrl.trim()}`).slice(0, 500)
      : null,
    source_key: key,
    seller_name: typeof meta?.sellerName === 'string' ? meta.sellerName.trim().slice(0, 100) || null : null
  });
  if (importError) {
    // Most likely someone imported the same post a moment ago. Don't leave an orphan listing.
    await admin.from('listings').delete().eq('id', listing.id);
    return fail(importError.code === '23505' ? 'That post has already been added to SaddleUp by someone.' : "Couldn't save the import.", importError.code);
  }
  return { data: { id: listing.id, claim_token: claim.token }, error: null };
}

export const dynamic = 'force-dynamic';

// Fields the form may set. Anything else in the request is ignored.
const ALLOWED = [
  'brand_id', 'model', 'discipline', 'seat_size', 'tree_width', 'panel_type', 'flap_length',
  'year_manufactured', 'condition', 'color', 'price_cents', 'description', 'tree_width_cm',
  'panel_length_cm', 'location_city', 'location_state', 'location_zip', 'trial_policy', 'panel_flocking', 'images', 'video_url',
  'slug', 'source', 'ebay_item_id', 'ebay_item_url', 'ebay_seller_username', 'ebay_imported_at',
  'pkg_length_in', 'pkg_width_in', 'pkg_height_in', 'pkg_weight_lb'
] as const;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Your session expired — please sign in again.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    mode?: 'create' | 'update' | 'seed';
    id?: string;
    listing?: Record<string, unknown>;
    import?: { sourceUrl?: unknown; sellerName?: unknown };
  } | null;
  if (!body?.listing || !body.mode) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });

  const row: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in body.listing) row[k] = body.listing[k];

  async function write(values: Record<string, unknown>) {
    if (body!.mode === 'update') {
      if (!body!.id) return { data: null, error: { message: 'Missing listing id.', code: '' } };
      const { slug: _keepSlug, source: _keepSource, ...changes } = values;
      // Importers fix unclaimed listings they added (no seller yet, so row-level security can't let them).
      const { access } = await listingAccess(body!.id);
      const db = access === 'importer' ? createAdminClient() : supabase;
      return db.from('listings').update(changes).eq('id', body!.id).select('id, slug, status, discipline, brands(slug)').single();
    }
    if (body!.mode === 'seed') return seedImport(values, user!.id, body!.import);
    return supabase
      .from('listings')
      .insert({ ...values, seller_id: user!.id, created_by: user!.id, status: 'draft' })
      .select('id')
      .single();
  }

  // Only our own storage can hold a listing's video.
  if (typeof row.video_url === 'string' && !row.video_url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/saddle-images/`)) {
    delete row.video_url;
  }

  let result = await write(row);
  // If a newer column hasn't been added in the database yet, save without it rather than fail.
  for (const col of ['video_url', 'location_zip']) {
    if (result.error?.code !== 'PGRST204' || !(col in row) || !String(result.error.message ?? '').includes(col)) continue;
    delete row[col];
    result = await write(row);
  }

  if (result.error || !result.data) {
    console.error('Listing save failed', result.error);
    const e = result.error as { message?: string; code?: string } | null;
    const message =
      e?.code === '23505' && row.ebay_item_id
        ? 'That eBay listing has already been imported to SaddleUp.'
        : e?.code === 'LIMIT' || e?.code === 'DUPLICATE'
          ? e.message!
          : e?.code === 'PGRST116' || e?.code === '42501'
            ? "You don't have permission to save this listing."
            : `Couldn't save: ${e?.message ?? 'unknown error'}`;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const saved = result.data as { status?: string; slug?: string } & Record<string, unknown>;
  if (body.mode === 'update' && saved.status === 'active' && saved.slug) {
    await notifyIndexNow(listingPaths(saved as any));
  }
  // A seller just added a saddle: confirm it's in, where it stands (in review), and link to it.
  if (body.mode === 'create' && typeof saved.id === 'string') {
    await sendListingEmail(saved.id, 'submitted');
  }
  return NextResponse.json(result.data);
}
