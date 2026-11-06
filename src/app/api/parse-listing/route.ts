// POST /api/parse-listing  { text: string, photos?: { media_type, data (base64) }[] }
// Reads pasted listing text (and optional photos: stamps, logos, screenshots) into form fields.
// Photos are only read, never stored. Uses Claude when ANTHROPIC_API_KEY is set,
// otherwise (or if the AI call fails) the rule-based reader. Signed-in users only, since
// each AI read costs money.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiParseListing, aiReaderConfigured, type ListingPhoto } from '@/lib/ai-parse-listing';
import { parseListingText, summarizeFill } from '@/lib/parse-listing-text';
import { zipForCity } from '@/lib/zip-lookup';
import type { ListingPrefill } from '@/lib/ebay/map';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { text?: unknown; photos?: unknown };
  const text = typeof body.text === 'string' ? body.text : '';
  const photos = readPhotos(body.photos);
  if (photos === 'invalid') {
    return NextResponse.json({ error: `Up to ${MAX_PHOTOS} photos (JPEG, PNG, WebP or GIF), please.` }, { status: 400 });
  }
  if (!text.trim() && !photos.length) {
    return NextResponse.json({ error: 'Paste some text or add a photo first.' }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: 'That’s too long — paste just the one listing.' }, { status: 400 });
  }

  const { data: brands } = await supabase.from('brands').select('id, name');

  if (aiReaderConfigured() && brands?.length) {
    try {
      const { prefill, warnings, photoFindings, photoKinds } = await aiParseListing(text, brands, photos);
      await addZip(prefill);
      return NextResponse.json({ prefill, ...summarizeFill(prefill), warnings, photoFindings, photoKinds, reader: 'ai' });
    } catch (e) {
      console.error('AI listing reader failed; using rules instead', e);
    }
  }

  const photoNote = aiReaderConfigured()
    ? "The photo reader didn't respond, so the photos weren't read this time."
    : "Reading photos needs the AI reader, which isn't switched on yet (no ANTHROPIC_API_KEY).";
  if (!text.trim()) return NextResponse.json({ error: photoNote }, { status: 503 });

  const parsed = parseListingText(text, brands ?? []);
  await addZip(parsed.prefill);
  return NextResponse.json({ ...parsed, warnings: photos.length ? [...parsed.warnings, photoNote] : parsed.warnings, reader: 'rules' });
}

/** Post gave a town but no ZIP: look one up so the ZIP box is filled in too. */
async function addZip(prefill: ListingPrefill) {
  if (prefill.location_zip) return;
  const zip = await zipForCity(prefill.location_city, prefill.location_state);
  if (zip) prefill.location_zip = zip;
}

const MAX_PHOTOS = 6;
const MAX_PHOTO_CHARS = 1_000_000; // base64 of a ~750 KB image; the browser shrinks photos well below this
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function readPhotos(raw: unknown): ListingPhoto[] | 'invalid' {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_PHOTOS) return 'invalid';
  const out: ListingPhoto[] = [];
  for (const p of raw) {
    const { media_type, data } = (p ?? {}) as { media_type?: unknown; data?: unknown };
    if (typeof media_type !== 'string' || !PHOTO_TYPES.has(media_type)) return 'invalid';
    if (typeof data !== 'string' || !data || data.length > MAX_PHOTO_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return 'invalid';
    out.push({ media_type: media_type as ListingPhoto['media_type'], data });
  }
  return out;
}
