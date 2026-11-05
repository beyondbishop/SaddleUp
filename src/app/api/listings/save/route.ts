// POST /api/listings/save  { mode: 'create' | 'update' | 'seed', id?: string, listing: {...} }
// Saves a listing on the server with the signed-in user's session. Row-level security still
// decides what's allowed: sellers create/update their own listings; admins can seed hidden
// 'unclaimed' listings with no seller. (Saving from the browser could hang while the browser
// Supabase client waited on its auth lock, leaving the form stuck on "Saving…".)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Fields the form may set. Anything else in the request is ignored.
const ALLOWED = [
  'brand_id', 'model', 'discipline', 'seat_size', 'tree_width', 'panel_type', 'flap_length',
  'year_manufactured', 'condition', 'color', 'price_cents', 'description', 'tree_width_cm',
  'panel_length_cm', 'location_city', 'location_state', 'location_zip', 'trial_policy', 'panel_flocking', 'images',
  'slug', 'source', 'ebay_item_id', 'ebay_item_url', 'ebay_seller_username', 'ebay_imported_at'
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
  } | null;
  if (!body?.listing || !body.mode) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });

  const row: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in body.listing) row[k] = body.listing[k];

  async function write(values: Record<string, unknown>) {
    if (body!.mode === 'update') {
      if (!body!.id) return { data: null, error: { message: 'Missing listing id.', code: '' } };
      const { slug: _keepSlug, source: _keepSource, ...changes } = values;
      return supabase.from('listings').update(changes).eq('id', body!.id).select('id').single();
    }
    if (body!.mode === 'seed') {
      return supabase
        .from('listings')
        .insert({ ...values, seller_id: null, status: 'unclaimed', source: 'seeded' })
        .select('id, claim_token')
        .single();
    }
    return supabase
      .from('listings')
      .insert({ ...values, seller_id: user!.id, status: 'draft' })
      .select('id')
      .single();
  }

  let result = await write(row);
  // If a newer column hasn't been added in the database yet, save without it rather than fail.
  if (result.error?.code === 'PGRST204' && 'location_zip' in row) {
    const { location_zip: _skip, ...rest } = row;
    result = await write(rest);
  }

  if (result.error || !result.data) {
    console.error('Listing save failed', result.error);
    const e = result.error as { message?: string; code?: string } | null;
    const message =
      e?.code === '23505' && row.ebay_item_id
        ? 'That eBay listing has already been imported to SaddleUp.'
        : e?.code === 'PGRST116' || e?.code === '42501'
          ? "You don't have permission to save this listing."
          : `Couldn't save: ${e?.message ?? 'unknown error'}`;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(result.data);
}
