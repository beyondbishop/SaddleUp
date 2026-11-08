// GET /api/imports/check?url=<link to the post>
// Before an importer does any work, says whether this post is already on SaddleUp: who added it,
// when, and where it stands (waiting for the seller, claimed, sold, or removed - removed listings
// stay on record so the same post is never re-added). Importers and admins only.

import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/server';
import { sourceKey } from '@/lib/import-source';

export const dynamic = 'force-dynamic';

/** How links were keyed before Facebook group/permalink shapes were decoded, so older imports still match. */
function legacyKey(url: string): string | null {
  try {
    const u = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`);
    const host = u.hostname.replace(/^(www\.|m\.|web\.)/, '');
    return `${host}${u.pathname.replace(/\/+$/, '')}`.toLowerCase().slice(0, 300);
  } catch {
    return null;
  }
}

function stage(l: { status: string; seller_id: string | null } | null): { label: string; tone: 'stop' | 'info' } {
  if (!l) return { label: 'Added to SaddleUp', tone: 'stop' };
  switch (l.status) {
    case 'unclaimed':
      return { label: 'On SaddleUp, waiting for the seller to claim it', tone: 'stop' };
    case 'removed':
      return {
        label: l.seller_id ? 'Removed by the seller after claiming it' : 'Removed (the seller asked not to be on SaddleUp, or it was taken down)',
        tone: 'stop'
      };
    case 'sold':
      return { label: 'Sold', tone: 'stop' };
    case 'active':
    case 'pending_sale':
      return { label: 'Claimed by the seller and live', tone: 'stop' };
    default:
      return { label: 'Claimed by the seller', tone: 'stop' };
  }
}

export async function GET(req: Request) {
  const { user, isImporter } = await getViewer();
  if (!user || !isImporter) return NextResponse.json({ error: 'Importers only.' }, { status: 403 });

  const url = new URL(req.url).searchParams.get('url') ?? '';
  const key = sourceKey(url);
  if (!key) return NextResponse.json({ valid: false, existing: null });

  const keys = Array.from(new Set([key, legacyKey(url)].filter((k): k is string => !!k)));
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('listing_imports')
    .select('importer_id, created_at, listings(status, seller_id, slug)')
    .in('source_key', keys)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!row) return NextResponse.json({ valid: true, existing: null });

  const listing = (Array.isArray(row.listings) ? row.listings[0] : row.listings) as { status: string; seller_id: string | null; slug: string } | null;
  let importedBy = 'you';
  if (row.importer_id !== user.id) {
    const { data: who } = await admin.from('profiles').select('full_name').eq('id', row.importer_id).maybeSingle();
    importedBy = who?.full_name?.trim() || 'another importer';
  }
  const { label } = stage(listing);
  return NextResponse.json({
    valid: true,
    existing: {
      importedBy,
      importedAt: row.created_at,
      status: listing?.status ?? null,
      label,
      // Only link to pages a shopper could see; removed listings aren't public.
      slug: listing && listing.status !== 'removed' ? listing.slug : null
    }
  });
}

/**
 * POST /api/imports/check  { brand_id, seat_size, price, model, seller_name }
 * Second safety net for links we can't match (Facebook share links differ for every person):
 * after the post is read, look for a recent import of what looks like the same saddle - same
 * brand and seat, plus a matching price, model or seller name.
 */
export async function POST(req: Request) {
  const { user, isImporter } = await getViewer();
  if (!user || !isImporter) return NextResponse.json({ error: 'Importers only.' }, { status: 403 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const brandId = Number(b.brand_id);
  const seat = Number(b.seat_size);
  if (!(brandId > 0) || !(seat > 0)) return NextResponse.json({ matches: [] });
  const price = Number(b.price) > 0 ? Number(b.price) : null;
  const norm = (v: unknown) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '');
  const model = norm(b.model);
  const sellerFirst = norm(b.seller_name).split(' ')[0] ?? '';

  const admin = createAdminClient();
  const since = new Date(Date.now() - 180 * 864e5).toISOString();
  const { data: rows } = await admin
    .from('listing_imports')
    .select('importer_id, seller_name, created_at, listings!inner(status, seller_id, slug, model, price_cents, brand_id, seat_size)')
    .gte('created_at', since)
    .eq('listings.brand_id', brandId)
    .eq('listings.seat_size', seat)
    .limit(50);

  const matches = [];
  for (const r of rows ?? []) {
    const l = (Array.isArray(r.listings) ? r.listings[0] : r.listings) as any;
    if (!l) continue;
    const samePrice = price != null && l.price_cents && Math.abs(l.price_cents / 100 - price) <= price * 0.05;
    const lm = norm(l.model);
    const sameModel = !!model && !!lm && (lm.includes(model) || model.includes(lm));
    const sameSeller = !!sellerFirst && norm(r.seller_name).split(' ')[0] === sellerFirst;
    if (!(samePrice || sameModel || sameSeller)) continue;
    let importedBy = 'you';
    if (r.importer_id !== user.id) {
      const { data: who } = await admin.from('profiles').select('full_name').eq('id', r.importer_id).maybeSingle();
      importedBy = who?.full_name?.trim() || 'another importer';
    }
    matches.push({
      importedBy,
      importedAt: r.created_at,
      sellerName: r.seller_name,
      model: l.model,
      price: l.price_cents ? l.price_cents / 100 : null,
      label: stage(l).label,
      slug: l.status !== 'removed' ? l.slug : null
    });
    if (matches.length >= 3) break;
  }
  return NextResponse.json({ matches });
}
