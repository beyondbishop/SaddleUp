// IndexNow: tells Bing (and other IndexNow search engines — Yandex, Seznam, Naver; ChatGPT search
// uses Bing's index) the moment a page is published, changed or removed, instead of waiting for
// them to re-read the sitemap. Google doesn't take part in IndexNow; it relies on sitemap.xml.
//
// The key is public by design: it's served at /<key>.txt (public/<key>.txt) so search engines
// can confirm these notices really come from saddleup.me.

import 'server-only';
import { SITE_URL, brandPath, disciplinePath } from './seo';
import type { Discipline } from './types';

export const INDEXNOW_KEY = 'b1594838edaff57fdb7ccfd013002627';

/**
 * Sends the given site paths (e.g. "/saddles/abc") to IndexNow. Only runs on the live site, never
 * throws, and gives up after 4 seconds so it can't slow down the action that triggered it.
 */
export async function notifyIndexNow(paths: string[]): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return;
  const urlList = Array.from(new Set(paths.filter(Boolean))).map((p) => `${SITE_URL}${p}`);
  if (!urlList.length) return;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList
      }),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok && res.status !== 202) console.error('IndexNow rejected the notice', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.error('IndexNow notice failed', e);
  }
}

/** The pages that change when a listing goes live, changes or comes down. */
export function listingPaths(listing: { slug: string; discipline: Discipline; brands?: { slug: string } | null }) {
  return [
    `/saddles/${listing.slug}`,
    disciplinePath(listing.discipline),
    listing.brands?.slug && listing.brands.slug !== 'other' ? brandPath(listing.brands.slug) : '',
    '/',
    '/saddles'
  ];
}
