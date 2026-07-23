export type Discipline =
  | 'hunter_jumper' | 'dressage' | 'all_purpose' | 'western'
  | 'pony_child' | 'endurance' | 'eventing';

export type TreeWidth =
  | 'x_narrow' | 'narrow' | 'medium_narrow' | 'medium'
  | 'medium_wide' | 'wide' | 'x_wide' | 'adjustable';

export const TREE_WIDTH_LABELS: Record<TreeWidth, string> = {
  x_narrow: 'X-Narrow',
  narrow: 'Narrow',
  medium_narrow: 'Medium/Narrow',
  medium: 'Medium',
  medium_wide: 'Medium/Wide',
  wide: 'Wide',
  x_wide: 'X-Wide',
  adjustable: 'Adjustable'
};

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  hunter_jumper: 'Hunter/Jumper',
  dressage: 'Dressage',
  all_purpose: 'All Purpose',
  western: 'Western',
  pony_child: 'Pony/Child',
  endurance: 'Endurance',
  eventing: 'Eventing'
};

export interface Listing {
  id: string;
  seller_id: string;
  brand_id: number;
  brands?: { name: string; slug: string };
  model: string;
  discipline: Discipline;
  seat_size: number;
  tree_width: TreeWidth;
  panel_type: string | null;
  flap_length: string | null;
  year_manufactured: number | null;
  condition: string | null;
  color: string | null;
  price_cents: number;
  description: string | null;
  images: string[];
  slug: string;
  status: 'draft' | 'unclaimed' | 'active' | 'pending_sale' | 'sold' | 'removed';
  location_city: string | null;
  location_state: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
}
