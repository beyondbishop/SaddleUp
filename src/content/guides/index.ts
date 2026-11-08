// Every guide on the site. To add one: create a file next to this one (copy an existing guide)
// and add it to this list. The /guides pages, sitemap and llms.txt all read from here.

import type { Guide } from './types';
import whereToSell from './where-to-sell-used-saddle-online';

export const GUIDES: Guide[] = [whereToSell].sort((a, b) => b.published.localeCompare(a.published));

export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);

export type { Guide };
