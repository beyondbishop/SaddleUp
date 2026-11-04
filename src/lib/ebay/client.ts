// Server-only eBay Browse API client (application token, read-only public listing data).
// Needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET from developer.ebay.com > Application Keys.
// Set EBAY_ENV=sandbox to use sandbox keys; defaults to production.

import 'server-only';
import type { EbayItem } from './map';
import { isEbayShortLink, parseEbayItemId } from './map';

const API_HOST = process.env.EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';

export function ebayConfigured(): boolean {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

export class EbayError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function appToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${API_HOST}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
    cache: 'no-store'
  });
  if (!res.ok) {
    console.error('eBay token request failed', res.status, await res.text().catch(() => ''));
    throw new EbayError('eBay import is temporarily unavailable. Please fill in the form by hand.', 503);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/** Follows an ebay.us share link (max 3 hops, eBay hosts only) to the real listing URL. */
async function resolveShortLink(input: string): Promise<string> {
  let current = input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`;
  for (let hop = 0; hop < 3 && isEbayShortLink(current); hop++) {
    const res = await fetch(current, { redirect: 'manual', cache: 'no-store' });
    const next = res.headers.get('location');
    if (!next) break;
    current = new URL(next, current).toString();
  }
  return current;
}

export async function resolveItemId(input: string): Promise<string> {
  let id = parseEbayItemId(input);
  if (!id && isEbayShortLink(input)) id = parseEbayItemId(await resolveShortLink(input));
  if (!id) throw new EbayError("That doesn't look like an eBay listing link. Copy the address from your listing page, e.g. ebay.com/itm/123456789012.");
  return id;
}

export async function fetchEbayItem(legacyId: string): Promise<EbayItem> {
  const token = await appToken();
  const res = await fetch(
    `${API_HOST}/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(legacyId)}`,
    {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
      cache: 'no-store'
    }
  );

  if (res.ok) return (await res.json()) as EbayItem;

  const body = (await res.json().catch(() => ({}))) as { errors?: { errorId?: number; message?: string }[] };
  const errorId = body.errors?.[0]?.errorId;
  if (res.status === 404 || errorId === 11001) {
    throw new EbayError("We couldn't find that listing on eBay. It may have ended — fill in the form by hand instead.", 404);
  }
  if (errorId === 11006) {
    throw new EbayError('That listing has multiple variations, which we can’t import yet. Please fill in the form by hand.');
  }
  console.error('eBay get_item_by_legacy_id failed', res.status, JSON.stringify(body));
  throw new EbayError('eBay import is temporarily unavailable. Please fill in the form by hand.', 502);
}
