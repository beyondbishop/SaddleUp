// Client helper: send pasted text (and optional photos) to /api/parse-listing; if the request
// itself fails (offline, server error), read the text in the browser with the rule-based reader.

import { parseListingText, type ParsedListing } from './parse-listing-text';

export type ReadPhoto = { media_type: 'image/jpeg'; data: string };
export type ReadResult = ParsedListing & { reader: 'ai' | 'rules'; photoFindings?: string[]; photoKinds?: ('saddle' | 'stamp' | 'screenshot' | 'other')[]; modelCandidates?: string[]; spellingFixes?: string[]; sellerName?: string | null };

export async function readListingText(
  text: string,
  brands: { id: number; name: string }[],
  photos: ReadPhoto[] = []
): Promise<ReadResult | { error: string }> {
  try {
    const res = await fetch('/api/parse-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(photos.length ? { text, photos } : { text })
    });
    if (res.ok) return await res.json();
    const data = await res.json().catch(() => ({}));
    if (!text.trim() || (photos.length && res.status === 400)) return { error: data.error ?? "Couldn't read that." };
  } catch {
    if (!text.trim()) return { error: "Couldn't reach the photo reader. Check your connection and try again." };
  }
  const parsed = parseListingText(text, brands);
  return { ...parsed, warnings: photos.length ? [...parsed.warnings, "The photos couldn't be read this time."] : parsed.warnings, reader: 'rules' };
}
