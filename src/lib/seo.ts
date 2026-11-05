// Shared SEO/GEO bits: the site's address, clean URL slugs for disciplines, and the short
// intro copy on each discipline landing page (also used in llms.txt).

import type { Discipline } from './types';

export const SITE_URL = 'https://saddleup.me';

export const DISCIPLINE_SLUGS: Record<Discipline, string> = {
  hunter_jumper: 'hunter-jumper',
  dressage: 'dressage',
  all_purpose: 'all-purpose',
  eventing: 'eventing',
  pony_child: 'pony-child',
  western: 'western',
  endurance: 'endurance'
};

export const disciplineFromSlug = (slug: string): Discipline | null =>
  (Object.entries(DISCIPLINE_SLUGS).find(([, s]) => s === slug)?.[0] as Discipline) ?? null;

/** Answer-first copy: the first sentence says what the page is, so search and AI tools can quote it. */
export const DISCIPLINE_INTROS: Record<Discipline, { heading: string; intro: string }> = {
  hunter_jumper: {
    heading: 'Used Hunter/Jumper Saddles',
    intro:
      'Used hunter/jumper (close contact) saddles for sale, each listed with its exact seat size and tree width so you can shop by fit. Close contact saddles have a flatter seat and forward-cut flaps that keep the rider’s leg close to the horse over fences.'
  },
  dressage: {
    heading: 'Used Dressage Saddles',
    intro:
      'Used dressage saddles for sale, each listed with its exact seat size and tree width so you can shop by fit. Dressage saddles have a deeper seat and long, straight flaps that support a longer leg position.'
  },
  all_purpose: {
    heading: 'Used All Purpose Saddles',
    intro:
      'Used all purpose (general purpose) English saddles for sale, each listed with its exact seat size and tree width. All purpose saddles sit between close contact and dressage designs, for riders who do a bit of everything.'
  },
  eventing: {
    heading: 'Used Eventing Saddles',
    intro:
      'Used eventing saddles for sale, each listed with its exact seat size and tree width so you can shop by fit. Eventing saddles are built for cross-country and jumping, usually with more knee and thigh support than a close contact saddle.'
  },
  pony_child: {
    heading: 'Used Pony and Children’s Saddles',
    intro:
      'Used pony and children’s saddles for sale, usually in smaller seat sizes (about 12" to 16.5"), each listed with its tree width so it fits both the pony and the young rider.'
  },
  western: {
    heading: 'Used Western Saddles',
    intro:
      'Used western saddles for sale, each listed with its seat size and bar type (semi-quarter horse, full quarter horse, Arabian or draft) so you can shop by fit — for trail, pleasure, ranch, barrel and roping.'
  },
  endurance: {
    heading: 'Used Endurance Saddles',
    intro:
      'Used endurance saddles for sale, in English and western styles, each listed with its seat size and tree width. Endurance saddles are built for comfort over long distances for both horse and rider.'
  }
};

export const brandPath = (slug: string) => `/brands/${slug}`;
export const disciplinePath = (d: Discipline) => `/disciplines/${DISCIPLINE_SLUGS[d]}`;
