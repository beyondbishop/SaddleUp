// POST /api/listings/pick-cover  { images: string[] }
// Returns the photos reordered so the best cover (saddle side-on, facing right, cantle on the left)
// is first. Only photos stored on SaddleUp are accepted. If the check can't run, the order is kept.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickCoverPhoto } from '@/lib/ai-cover-photo';
import { isOurStorageUrl } from '@/lib/storage-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX = 20;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { images?: unknown };
  const images = Array.isArray(body.images) ? body.images.filter((u): u is string => typeof u === 'string') : [];
  if (!images.length || images.length > MAX || !images.every(isOurStorageUrl)) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const pick = await pickCoverPhoto(images);
  if (!pick || pick.index === 0) return NextResponse.json({ images, changed: false, facingRight: pick?.facingRight ?? null });
  const reordered = [images[pick.index], ...images.filter((_, i) => i !== pick.index)];
  return NextResponse.json({ images: reordered, changed: true, facingRight: pick.facingRight });
}
