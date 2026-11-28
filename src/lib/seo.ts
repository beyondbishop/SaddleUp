// Shared SEO/GEO bits: the site's address, clean URL slugs for disciplines, and the short
// intro copy on each discipline landing page (also used in llms.txt).

import type { Discipline, TreeWidth } from './types';

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

// --- Seat size and tree width landing pages (/seat-size/17-5, /tree-width/medium) ---

/** Seat sizes with a landing page: whole and half inches across English and western saddles. */
export const SEAT_SIZES = Array.from({ length: 21 }, (_, i) => 10 + i * 0.5); // 10" to 20"

/** 17.5 -> "17-5", 17 -> "17" (a dot in a URL slug looks like a file extension). */
export const seatSlug = (size: number) => String(Number(size)).replace('.', '-');

export const seatFromSlug = (slug: string): number | null => {
  if (!/^\d{1,2}(-5)?$/.test(slug)) return null;
  const size = Number(slug.replace('-', '.'));
  return SEAT_SIZES.includes(size) ? size : null;
};

export const seatPath = (size: number) => `/seat-size/${seatSlug(size)}`;

/** Answer-first copy for a seat size page. */
export const seatIntro = (size: number) =>
  `Used ${size}" saddles for sale on SaddleUp — close contact, eventing, all purpose and more — each listed with its tree width, condition and location so you can find one that fits your horse as well as you. Seat size is measured from the nail head beside the pommel to the center of the cantle, and saddles with the same number can ride differently depending on seat depth and flap length, so check those too.`;

export const TREE_SLUGS: Record<TreeWidth, string> = {
  x_narrow: 'x-narrow',
  narrow: 'narrow',
  medium_narrow: 'medium-narrow',
  medium: 'medium',
  medium_wide: 'medium-wide',
  wide: 'wide',
  x_wide: 'x-wide',
  adjustable: 'adjustable'
};

export const treeFromSlug = (slug: string): TreeWidth | null =>
  (Object.entries(TREE_SLUGS).find(([, s]) => s === slug)?.[0] as TreeWidth) ?? null;

export const treePath = (t: TreeWidth) => `/tree-width/${TREE_SLUGS[t]}`;

/** Answer-first copy for a tree width page. */
export const treeIntro = (t: TreeWidth, label: string) =>
  t === 'adjustable'
    ? 'Used adjustable tree saddles for sale on SaddleUp, each listed with its exact seat size, condition and location. An adjustable tree can be changed to a different width — by swapping the gullet plate or by a saddle fitter, depending on the brand — so the saddle can follow your horse as their shape changes or move to a new horse.'
    : `Used ${label.toLowerCase()} tree saddles for sale on SaddleUp, each listed with its exact seat size, condition and location. The tree width sets how the saddle sits across your horse’s withers and shoulders. Widths are reported by the seller and vary by brand — one maker’s medium can fit like another’s medium/wide — so compare the saddle against your horse, not just the label.`;
