// Client helper: send pasted text to /api/parse-listing; if the request itself fails
// (offline, server error), read it in the browser with the rule-based reader instead.

import { parseListingText, type ParsedListing } from './parse-listing-text';

export async function readListingText(
  text: string,
  brands: { id: number; name: string }[]
): Promise<ParsedListing & { reader: 'ai' | 'rules' }> {
  try {
    const res = await fetch('/api/parse-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (res.ok) return await res.json();
  } catch {
    // fall through to the local reader
  }
  return { ...parseListingText(text, brands), reader: 'rules' };
}
