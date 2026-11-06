// GET /api/claim/[token]  ->  { images: string[] }
// Photos for an unclaimed listing, so the claim page can show the seller their saddle.
// The claim token is the secret; once claimed (or for any other listing) this returns nothing.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) return NextResponse.json({ images: [] });
  const { data } = await createAdminClient()
    .from('listings')
    .select('images')
    .eq('claim_token', params.token)
    .eq('status', 'unclaimed')
    .is('seller_id', null)
    .maybeSingle();
  return NextResponse.json({ images: ((data?.images as string[] | null) ?? []).slice(0, 4) });
}
