// POST /api/listings/:id/import-notes
// Saves what the importer's tools noticed about a saddle (spelling, judgment calls, measuring help)
// so the seller sees them on the Edit page after claiming. Only the importer who added the
// (still unclaimed) listing, or an admin, may write them.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { listingAccess } from '@/lib/listing-access';

export const dynamic = 'force-dynamic';

const strings = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && !!s.trim()).map((s) => s.trim().slice(0, 600)).slice(0, max) : [];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, access } = await listingAccess(params.id);
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (access !== 'importer' && access !== 'admin') return NextResponse.json({ error: 'Not your import.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const notes = {
    spellingFixes: strings(body.spellingFixes, 3),
    listingNotes: strings(body.listingNotes, 3),
    measureGuide: body.measureGuide === true
  };
  const { error } = await createAdminClient().from('listing_imports').update({ seller_notes: notes }).eq('listing_id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
