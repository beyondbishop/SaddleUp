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
