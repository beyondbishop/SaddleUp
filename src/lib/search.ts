// One definition of "which saddles match these criteria", shared by the browse page, named
// lists, and alert emails. Criteria round-trip through URL query params, so a search, a saved
// list, and an emailed link all describe the same thing.
//
// Two implementations of the same rules live here, and must stay in step:
//   applyCriteria()  narrows a Supabase query (browse pages)
//   matchListing()   checks one listing in memory and explains why (alerts, list suggestions)

import {
  DISCIPLINE_LABELS,
  PANEL_FLOCKING_LABELS,
  TREE_WIDTH_LABELS,
  type Discipline,
  type PanelFlocking,
  type TreeWidth
} from '@/lib/types';

export const CONDITION_LABELS = {
  new: 'New / never used',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair'
} as const;
export type Condition = keyof typeof CONDITION_LABELS;

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
] as const;

export interface SearchCriteria {
  discipline?: Discipline;
  brand?: string; // brand slug
  model?: string; // words that must appear in the model name
  seat_min?: number;
  seat_max?: number;
  tree?: TreeWidth[];
  price_min?: number; // dollars
  price_max?: number; // dollars
  condition?: Condition[];
  state?: string; // 2-letter code
  panels?: PanelFlocking[];
  flap?: string; // words that must appear in the seller's flap/panel description
  /** Also show saddles where a filtered detail (condition, location, panels, flap) wasn't stated. */
  include_unknown?: boolean;
}

/** The listing fields matching reads. */
export interface MatchableListing {
  discipline: Discipline;
  brands?: { name?: string; slug?: string } | null;
  model: string;
  seat_size: number;
  tree_width: TreeWidth;
  price_cents: number;
  condition: string | null;
  location_state: string | null;
  panel_flocking?: PanelFlocking | null;
  panel_type: string | null;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

const TREE_KEYS = Object.keys(TREE_WIDTH_LABELS) as TreeWidth[];
const PANEL_KEYS = Object.keys(PANEL_FLOCKING_LABELS) as PanelFlocking[];
const CONDITION_KEYS = Object.keys(CONDITION_LABELS) as Condition[];

function getAll(src: ParamSource, key: string): string[] {
  if (src instanceof URLSearchParams) return src.getAll(key);
  const v = src[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}
const first = (src: ParamSource, key: string) => getAll(src, key)[0]?.trim() || undefined;

function num(v: string | undefined, min: number, max: number): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Keep letters, digits, spaces, hyphens and dots: safe inside PostgREST filters and ILIKE. */
function words(v: string | undefined): string | undefined {
  const cleaned = v?.replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned || undefined;
}

function allowed<T extends string>(values: string[], keys: readonly T[]): T[] | undefined {
  const picked = [...new Set(values.filter((v): v is T => (keys as readonly string[]).includes(v)))];
  return picked.length ? picked : undefined;
}

/** Read criteria from URL params (or a saved list), dropping anything invalid. */
export function parseCriteria(src: ParamSource): SearchCriteria {
  const discipline = first(src, 'discipline');
  const brand = first(src, 'brand');
  const state = first(src, 'state')?.toUpperCase();
  const c: SearchCriteria = {
    discipline: discipline && discipline in DISCIPLINE_LABELS ? (discipline as Discipline) : undefined,
    brand: brand && /^[a-z0-9-]{1,60}$/.test(brand) ? brand : undefined,
    model: words(first(src, 'model')),
    seat_min: num(first(src, 'seat_min'), 10, 22),
    seat_max: num(first(src, 'seat_max'), 10, 22),
    tree: allowed(getAll(src, 'tree'), TREE_KEYS),
    price_min: num(first(src, 'price_min'), 0, 1_000_000),
    price_max: num(first(src, 'price_max'), 0, 1_000_000),
    condition: allowed(getAll(src, 'condition'), CONDITION_KEYS),
    state: state && (US_STATES as readonly string[]).includes(state) ? state : undefined,
    panels: allowed(getAll(src, 'panels'), PANEL_KEYS),
    flap: words(first(src, 'flap')),
    include_unknown: first(src, 'unknown') === '1' || undefined
  };
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) as SearchCriteria;
}

/** Criteria -> URL params, in a stable order (so equal searches produce equal URLs). */
export function criteriaToParams(c: SearchCriteria): URLSearchParams {
  const p = new URLSearchParams();
  if (c.discipline) p.set('discipline', c.discipline);
  if (c.brand) p.set('brand', c.brand);
  if (c.model) p.set('model', c.model);
  if (c.seat_min !== undefined) p.set('seat_min', String(c.seat_min));
  if (c.seat_max !== undefined) p.set('seat_max', String(c.seat_max));
  c.tree?.forEach((t) => p.append('tree', t));
  if (c.price_min !== undefined) p.set('price_min', String(c.price_min));
  if (c.price_max !== undefined) p.set('price_max', String(c.price_max));
  c.condition?.forEach((v) => p.append('condition', v));
  if (c.state) p.set('state', c.state);
  c.panels?.forEach((v) => p.append('panels', v));
  if (c.flap) p.set('flap', c.flap);
  if (c.include_unknown) p.set('unknown', '1');
  return p;
}

export function searchUrl(c: SearchCriteria) {
  const qs = criteriaToParams(c).toString();
  return qs ? `/saddles?${qs}` : '/saddles';
}

export function hasCriteria(c: SearchCriteria) {
  return Object.keys(c).some((k) => k !== 'include_unknown');
}

/** True when an optional detail filter is active, so "include unknown" means something. */
export function filtersOnOptionalDetails(c: SearchCriteria) {
  return !!(c.condition || c.state || c.panels || c.flap);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Narrow a Supabase listings query to the criteria. `brandId` is the id for `c.brand`
 * (pass null when the slug isn't a known brand: nothing matches).
 */
export function applyCriteria<Q>(query: Q, c: SearchCriteria, brandId?: number | null): Q {
  let q = query as any;
  const unknown = !!c.include_unknown;

  if (c.discipline) q = q.eq('discipline', c.discipline);
  if (c.brand) q = brandId == null ? q.eq('brand_id', -1) : q.eq('brand_id', brandId);
  if (c.model) for (const w of c.model.split(' ')) q = q.ilike('model', `%${escapeLike(w)}%`);
  if (c.seat_min !== undefined) q = q.gte('seat_size', c.seat_min);
  if (c.seat_max !== undefined) q = q.lte('seat_size', c.seat_max);
  if (c.tree) q = q.in('tree_width', c.tree);
  if (c.price_min !== undefined) q = q.gte('price_cents', Math.round(c.price_min * 100));
  if (c.price_max !== undefined) q = q.lte('price_cents', Math.round(c.price_max * 100));

  const inOrUnknown = (col: string, values: string[]) =>
    unknown ? q.or(`${col}.in.(${values.join(',')}),${col}.is.null`) : q.in(col, values);
  if (c.condition) q = inOrUnknown('condition', c.condition);
  if (c.state) q = inOrUnknown('location_state', [c.state]);
  if (c.panels) q = inOrUnknown('panel_flocking', c.panels);
  if (c.flap) {
    for (const w of c.flap.split(' ')) {
      // Values are sanitized by words(); quote them for the or() filter.
      q = unknown
        ? q.or(`panel_type.ilike."%${escapeLike(w)}%",panel_type.is.null`)
        : q.ilike('panel_type', `%${escapeLike(w)}%`);
    }
  }
  return q as Q;
}

export interface MatchResult {
  matches: boolean;
  /** Plain-language reasons it matches, e.g. '17" seat (you want 16.5–17.5")'. */
  reasons: string[];
  /** Filtered details the seller didn't state (only matched because include_unknown is on). */
  unknown: string[];
}

const fmtPrice = (dollars: number) => `$${dollars.toLocaleString('en-US')}`;
const range = (min: number | undefined, max: number | undefined, unit = '') =>
  min !== undefined && max !== undefined
    ? `${min}${unit}–${max}${unit}`
    : min !== undefined
      ? `${min}${unit} or more`
      : `up to ${max}${unit}`;

/** Check one listing against criteria, with reasons. Same rules as applyCriteria(). */
export function matchListing(l: MatchableListing, c: SearchCriteria): MatchResult {
  const reasons: string[] = [];
  const unknown: string[] = [];
  const no = { matches: false, reasons: [], unknown: [] };
  const lower = (s: string | null | undefined) => (s ?? '').toLowerCase();

  if (c.discipline) {
    if (l.discipline !== c.discipline) return no;
    reasons.push(DISCIPLINE_LABELS[c.discipline]);
  }
  if (c.brand) {
    if (l.brands?.slug !== c.brand) return no;
    reasons.push(l.brands?.name ?? c.brand);
  }
  if (c.model) {
    if (!c.model.split(' ').every((w) => lower(l.model).includes(w.toLowerCase()))) return no;
    reasons.push(`Model: ${l.model}`);
  }
  if (c.seat_min !== undefined || c.seat_max !== undefined) {
    if (c.seat_min !== undefined && l.seat_size < c.seat_min) return no;
    if (c.seat_max !== undefined && l.seat_size > c.seat_max) return no;
    reasons.push(`${l.seat_size}" seat (you want ${range(c.seat_min, c.seat_max, '"')})`);
  }
  if (c.tree) {
    if (!c.tree.includes(l.tree_width)) return no;
    reasons.push(`${TREE_WIDTH_LABELS[l.tree_width]} tree (seller-reported)`);
  }
  if (c.price_min !== undefined || c.price_max !== undefined) {
    const dollars = l.price_cents / 100;
    if (c.price_min !== undefined && dollars < c.price_min) return no;
    if (c.price_max !== undefined && dollars > c.price_max) return no;
    reasons.push(
      `${fmtPrice(dollars)} (${c.price_min !== undefined && c.price_max !== undefined
        ? `${fmtPrice(c.price_min)}–${fmtPrice(c.price_max)}`
        : c.price_max !== undefined ? `under ${fmtPrice(c.price_max)}` : `${fmtPrice(c.price_min!)} or more`})`
    );
  }

  // Optional details: a missing value matches only when include_unknown is on.
  const optional = (label: string, value: string | null | undefined, ok: (v: string) => boolean, shown: string) => {
    if (value == null || value === '') {
      if (!c.include_unknown) return false;
      unknown.push(label);
      return true;
    }
    if (!ok(value)) return false;
    reasons.push(shown);
    return true;
  };
  if (c.condition && !optional('Condition', l.condition, (v) => (c.condition as string[]).includes(v),
      `${CONDITION_LABELS[l.condition as Condition] ?? l.condition} condition`)) return no;
  if (c.state && !optional('Location', l.location_state, (v) => v.toUpperCase() === c.state, `Located in ${l.location_state}`)) return no;
  if (c.panels && !optional('Panels', l.panel_flocking, (v) => (c.panels as string[]).includes(v),
      PANEL_FLOCKING_LABELS[l.panel_flocking as PanelFlocking] ?? '')) return no;
  if (c.flap && !optional('Flap/panel', l.panel_type,
      (v) => c.flap!.split(' ').every((w) => v.toLowerCase().includes(w.toLowerCase())), `Flap/panel: ${l.panel_type}`)) return no;

  return { matches: true, reasons, unknown };
}

/** Short human summary of criteria, e.g. ['Dressage', '17–17.5" seat', 'Medium tree']. */
export function describeCriteria(c: SearchCriteria, brandName?: string): string[] {
  const out: string[] = [];
  if (c.discipline) out.push(DISCIPLINE_LABELS[c.discipline]);
  if (c.brand) out.push(brandName ?? c.brand);
  if (c.model) out.push(`“${c.model}”`);
  if (c.seat_min !== undefined || c.seat_max !== undefined) out.push(`${range(c.seat_min, c.seat_max, '"')} seat`);
  if (c.tree) out.push(c.tree.map((t) => TREE_WIDTH_LABELS[t]).join('/') + ' tree');
  if (c.price_min !== undefined || c.price_max !== undefined)
    out.push(c.price_max !== undefined && c.price_min === undefined ? `under ${fmtPrice(c.price_max)}` :
      c.price_min !== undefined && c.price_max === undefined ? `${fmtPrice(c.price_min)}+` :
      `${fmtPrice(c.price_min!)}–${fmtPrice(c.price_max!)}`);
  if (c.condition) out.push(c.condition.map((v) => CONDITION_LABELS[v]).join('/') + ' condition');
  if (c.state) out.push(`in ${c.state}`);
  if (c.panels) out.push(c.panels.map((v) => PANEL_FLOCKING_LABELS[v]).join('/'));
  if (c.flap) out.push(`flap “${c.flap}”`);
  if (c.include_unknown && filtersOnOptionalDetails(c)) out.push('including unstated details');
  return out;
}
