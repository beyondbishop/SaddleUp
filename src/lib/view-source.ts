// Classifies where a listing view came from, using the page's referrer.
// Pure (no Next/Supabase imports) so it can be unit-tested directly.

export type ViewSource =
  | 'saddleup_search'
  | 'saddleup_home'
  | 'saddleup_other'
  | 'google'
  | 'facebook'
  | 'instagram'
  | 'other_site'
  | 'direct';

export const VIEW_SOURCE_LABELS: Record<ViewSource, string> = {
  saddleup_search: 'SaddleUp search',
  saddleup_home: 'SaddleUp homepage',
  saddleup_other: 'Elsewhere on SaddleUp',
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  other_site: 'Other websites',
  direct: 'Direct / shared link'
};

/** Search filters worth showing sellers (others, like paging, are ignored). */
const FILTER_KEYS = ['discipline', 'brand', 'seat_min', 'seat_max', 'tree', 'panels', 'price_max'];

export interface ClassifiedView {
  source: ViewSource;
  referrerHost: string | null;
  searchFilters: Record<string, string | string[]> | null;
}

export function classifyReferrer(referrer: string | null | undefined, siteHosts: string[] = ['saddleup.me']): ClassifiedView {
  let url: URL;
  try {
    if (!referrer) throw new Error('none');
    url = new URL(referrer);
  } catch {
    return { source: 'direct', referrerHost: null, searchFilters: null };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const isSite = siteHosts.some((h) => host === h.replace(/^www\./, '')) || host === 'localhost';

  if (isSite) {
    if (url.pathname === '/saddles' || url.pathname === '/saddles/') {
      const filters: Record<string, string | string[]> = {};
      for (const key of FILTER_KEYS) {
        const values = url.searchParams.getAll(key).filter(Boolean);
        if (values.length) filters[key] = values.length === 1 ? values[0] : values;
      }
      return { source: 'saddleup_search', referrerHost: null, searchFilters: Object.keys(filters).length ? filters : null };
    }
    if (url.pathname === '/') return { source: 'saddleup_home', referrerHost: null, searchFilters: null };
    return { source: 'saddleup_other', referrerHost: null, searchFilters: null };
  }

  if (/(^|\.)google\.[a-z.]+$/.test(host)) return { source: 'google', referrerHost: host, searchFilters: null };
  if (/(^|\.)(facebook\.com|fb\.me|fb\.com|messenger\.com)$/.test(host)) {
    return { source: 'facebook', referrerHost: host, searchFilters: null };
  }
  if (/(^|\.)(instagram\.com|l\.instagram\.com)$/.test(host)) return { source: 'instagram', referrerHost: host, searchFilters: null };
  return { source: 'other_site', referrerHost: host, searchFilters: null };
}
