// POST /api/ebay/import  { url: string }
// Looks up a seller's own eBay listing, maps it to SaddleUp's listing fields, and copies the
// photos into our storage. Nothing is saved as a listing here — the seller reviews the
// pre-filled form, confirms the listing is theirs, and saves it as a normal draft.

import { NextResponse } from 'next/server';
import { approvedBrands } from '@/lib/brands-server';
import { createClient } from '@/lib/supabase/server';
import { EbayError, ebayConfigured, fetchEbayItem, resolveItemId } from '@/lib/ebay/client';
import { itemImageUrls, mapEbayItem, type EbaySource } from '@/lib/ebay/map';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  if (!ebayConfigured()) {
    return NextResponse.json({ error: 'eBay import isn’t set up yet.' }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || typeof url !== 'string' || url.length > 2000) {
    return NextResponse.json({ error: 'Paste the link to your eBay listing.' }, { status: 400 });
  }

  try {
    const itemId = await resolveItemId(url);

    // Don't let the same eBay listing be imported twice (by anyone).
    const { data: existing } = await supabase.rpc('ebay_item_already_imported', { p_item_id: itemId });
    if (existing === true) {
      return NextResponse.json(
        { error: 'That eBay listing has already been imported to SaddleUp. If it’s yours and you didn’t import it, contact us.' },
        { status: 409 }
      );
    }

    const item = await fetchEbayItem(itemId);
    const brands = await approvedBrands(supabase, 'id, name');
    const prefill = mapEbayItem(item, brands ?? []);

    const images = await copyImages(supabase, user.id, itemId, itemImageUrls(item));

    const source: EbaySource = {
      item_id: itemId,
      url: item.itemWebUrl ?? `https://www.ebay.com/itm/${itemId}`,
      seller_username: item.seller?.username ?? null,
      title: item.title ?? ''
    };

    const missing = (
      [
        ['brand_id', 'brand'],
        ['discipline', 'discipline'],
        ['seat_size', 'seat size'],
        ['tree_width', 'tree width'],
        ['price', 'price']
      ] as const
    )
      .filter(([k]) => prefill[k] == null)
      .map(([, label]) => label);

    return NextResponse.json({ prefill, images, source, missing });
  } catch (e) {
    if (e instanceof EbayError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('eBay import failed', e);
    return NextResponse.json({ error: 'Something went wrong importing that listing. Please fill in the form by hand.' }, { status: 500 });
  }
}

async function copyImages(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  itemId: string,
  urls: string[]
): Promise<string[]> {
  const results = await Promise.all(
    urls.map(async (src, i) => {
      try {
        const res = await fetch(src, { cache: 'no-store' });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !type.startsWith('image/')) return null;
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_IMAGE_BYTES) return null;
        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
        const path = `${userId}/ebay-${itemId}-${Date.now()}-${i}.${ext}`;
        const { error } = await supabase.storage.from('saddle-images').upload(path, buf, { contentType: type });
        if (error) {
          console.error('eBay image upload failed', error.message);
          return null;
        }
        return supabase.storage.from('saddle-images').getPublicUrl(path).data.publicUrl;
      } catch {
        return null;
      }
    })
  );
  return results.filter((u): u is string => !!u);
}
