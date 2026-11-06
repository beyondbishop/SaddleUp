// Client: the "What's your saddle worth?" check. Reads saddle photos with the AI reader, then
// estimates a price range. Works signed in or out (signed-out visitors get a few a day).

import { readListingText, type ReadResult } from './read-listing-text';
import type { PickedPhoto } from './listing-photos';

export type PriceRange = { low: number; typical: number; high: number; reasoning: string };
export interface SaddleCheck {
  result: ReadResult;
  price: PriceRange | null;
}

export async function runSaddleCheck(
  photos: PickedPhoto[],
  notes: string,
  brands: { id: number; name: string }[],
  onStep?: (step: string) => void
): Promise<SaddleCheck | { error: string }> {
  if (!photos.length) return { error: 'Add a few photos of your saddle first.' };
  onStep?.('Reading your photos…');
  const result = await readListingText(
    notes,
    brands,
    photos.map(({ media_type, data }) => ({ media_type, data }))
  );
  if ('error' in result) return result;
  if (result.reader !== 'ai') return { error: "We couldn't read your photos just now. Please try again in a minute." };

  onStep?.('Checking what saddles like yours sell for…');
  const p = result.prefill;
  const price = await fetch('/api/price-range', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand_id: p.brand_id,
      model: p.model,
      discipline: p.discipline,
      seat_size: p.seat_size,
      tree_width: p.tree_width,
      condition: p.condition,
      year_manufactured: p.year_manufactured,
      panel_type: p.panel_type,
      description: p.description
    })
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((r): PriceRange | null => (r && r.typical ? { low: r.low, typical: r.typical, high: r.high, reasoning: r.reasoning } : null));
  return { result, price };
}

/** The photos worth putting on the listing: saddle shots and the stamp, not screenshots. */
export function listingPhotoIndexes(result: ReadResult, count: number): number[] {
  return Array.from({ length: count }, (_, i) => i).filter((i) => ['saddle', 'stamp'].includes(result.photoKinds?.[i] ?? 'saddle'));
}
