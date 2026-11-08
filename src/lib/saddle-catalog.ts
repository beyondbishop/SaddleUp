// Reference data that drives the listing form's pick lists.
// The seller picks a DISCIPLINE first; that decides English vs Western, which brands show,
// which model names are suggested, and which seat sizes / tree widths are offered.
// Brands themselves live in the `brands` table (so filters/SEO pages work); this file adds which
// kind of saddle each brand makes and common model names to suggest. Sellers can always type a
// model that isn't listed. To add a brand: insert it in the `brands` table AND add it here.

import type { Discipline, TreeWidth } from './types';

export type SaddleType = 'english' | 'western';
/** Endurance saddles come in both English and Western styles. */
type Kind = SaddleType | 'any';

export const DISCIPLINE_CHOICES: { value: Discipline; label: string; hint: string }[] = [
  { value: 'hunter_jumper', label: 'Hunter/Jumper', hint: 'Close contact' },
  { value: 'dressage', label: 'Dressage', hint: 'Long straight flaps' },
  { value: 'all_purpose', label: 'All Purpose', hint: 'General purpose / GP' },
  { value: 'eventing', label: 'Eventing', hint: 'Jump & cross-country' },
  { value: 'pony_child', label: 'Pony/Child', hint: 'Small seats' },
  { value: 'western', label: 'Western', hint: 'Pleasure, trail, ranch, barrel…' },
  { value: 'endurance', label: 'Endurance', hint: 'English or Western style' }
];

function kindFor(d: Discipline | '' | null | undefined): Kind | null {
  if (!d) return null;
  if (d === 'western') return 'western';
  if (d === 'endurance') return 'any';
  return 'english';
}

const halfSteps = (from: number, to: number) => {
  const out: number[] = [];
  for (let n = from; n <= to + 1e-9; n += 0.5) out.push(Math.round(n * 10) / 10);
  return out;
};

/** English seats run 14–19" (ponies 12–16"); Western seats run 12–17". */
export function seatSizesFor(d: Discipline | '' | null): number[] {
  if (d === 'pony_child') return halfSteps(12, 16.5);
  const kind = kindFor(d);
  if (kind === 'english') return halfSteps(14, 19);
  if (kind === 'western') return halfSteps(12, 17);
  if (kind === 'any') return halfSteps(12, 19);
  return [];
}

export const formatSeat = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}"`;

const ENGLISH_TREES: { value: TreeWidth; label: string }[] = [
  { value: 'x_narrow', label: 'X-Narrow' },
  { value: 'narrow', label: 'Narrow' },
  { value: 'medium_narrow', label: 'Medium/Narrow' },
  { value: 'medium', label: 'Medium' },
  { value: 'medium_wide', label: 'Medium/Wide' },
  { value: 'wide', label: 'Wide' },
  { value: 'x_wide', label: 'X-Wide' },
  { value: 'adjustable', label: 'Adjustable / interchangeable gullet' }
];

/** Western makers describe fit by bar type; each maps to the closest SaddleUp tree width for search. */
const WESTERN_TREES: { value: TreeWidth; label: string }[] = [
  { value: 'narrow', label: 'Arabian bars (narrow)' },
  { value: 'medium', label: 'Semi-Quarter Horse bars (regular)' },
  { value: 'wide', label: 'Full Quarter Horse bars (wide)' },
  { value: 'x_wide', label: 'Draft / extra-wide bars' },
  { value: 'adjustable', label: 'Adjustable / flex tree' }
];

export function treeOptionsFor(d: Discipline | '' | null): { value: TreeWidth; label: string }[] {
  const kind = kindFor(d);
  if (!kind) return [];
  return kind === 'western' ? WESTERN_TREES : ENGLISH_TREES;
}

export const treeLabelFor = (d: Discipline | '' | null) => (kindFor(d) === 'western' ? 'Bars / Tree' : 'Tree Width');

// ---------- brands & models ----------

/** A model is suggested for every discipline unless it's tagged with the ones it's built for. */
type Model = string | { name: string; for: Discipline[] };
type BrandInfo = { type: SaddleType | 'both'; models: Model[] };

const JUMP: Discipline[] = ['hunter_jumper', 'eventing'];
const DRESSAGE: Discipline[] = ['dressage'];

const CATALOG: Record<string, BrandInfo> = {
  // English
  Albion: { type: 'english', models: ['SLK', 'K2', 'Legend', 'Revelation'] },
  Amerigo: { type: 'english', models: ['Vega', 'Pro'] },
  Antares: { type: 'english', models: ['Signature', 'Evolution', 'Spirit', 'Connexion'] },
  Bates: {
    type: 'english',
    models: ['Caprilli', { name: 'Isabell', for: DRESSAGE }, 'Elevation', 'Innova', 'Kimberley', 'All Purpose', { name: 'Pony', for: ['pony_child'] }]
  },
  'Black Country': { type: 'english', models: ['Vinici', 'Quantum', 'Eden'] },
  'Bruno Delgrange': { type: 'english', models: [] },
  Butet: { type: 'english', models: [] },
  Childeric: { type: 'english', models: [] },
  'County Saddlery': {
    type: 'english',
    models: [
      { name: 'Perfection', for: DRESSAGE },
      { name: 'Competitor', for: DRESSAGE },
      { name: 'Stabilizer', for: JUMP },
      'Innovation',
      'Conquest',
      'Fusion',
      'Logic'
    ]
  },
  CWD: { type: 'english', models: ['SE01', 'SE02', '2Gs', 'Mademoiselle'] },
  Devoucoux: {
    type: 'english',
    models: [
      { name: 'Biarritz', for: JUMP },
      { name: 'Chiberta', for: JUMP },
      { name: 'Oldara', for: JUMP },
      { name: 'Makila', for: DRESSAGE },
      'Socoa'
    ]
  },
  Equiline: { type: 'english', models: [] },
  Equipe: { type: 'english', models: ['Expression', 'Synergy', 'Emporio'] },
  Hermes: {
    type: 'english',
    models: [
      { name: 'Steinkraus', for: JUMP },
      { name: 'Oxer', for: JUMP },
      { name: 'Cavale', for: JUMP },
      'Talaris',
      { name: 'Corlandus', for: DRESSAGE }
    ]
  },
  'Henri de Rivel': { type: 'english', models: [] },
  'Kent & Masters': { type: 'english', models: [] },
  Kieffer: { type: 'english', models: [] },
  Passier: { type: 'english', models: ['Grand Gilbert', 'Optimum'] },
  Pessoa: {
    type: 'english',
    models: ['Gen X', 'A/O', 'Heritage', 'Legacy'].map((name) => ({ name, for: [...JUMP, 'all_purpose' as Discipline] }))
  },
  Prestige: { type: 'english', models: ['Roma', 'Meredith', 'X-Breath', 'X-Paris', 'Venus'] },
  Schleese: { type: 'english', models: ['Wave', 'Obrigado', 'JES'] },
  Stubben: { type: 'english', models: ['Genesis', 'Siegfried', 'Portos', 'Edelweiss', 'Juventus', 'Tristan'] },
  'Tad Coffin': { type: 'english', models: ['A5'] },
  Thorowgood: { type: 'english', models: ['T4', 'T6', 'T8'] },
  'Voltaire Design': {
    type: 'english',
    models: [
      { name: 'Palm Beach', for: JUMP },
      { name: 'Lexington', for: JUMP },
      { name: 'Blenheim', for: JUMP },
      'Adelaide',
      { name: 'Stuttgart', for: DRESSAGE }
    ]
  },
  Wintec: { type: 'english', models: ['500', '2000', 'Pro', { name: 'Isabell', for: DRESSAGE }, '250'] },
  // Western
  'Big Horn': { type: 'western', models: [] },
  'Billy Cook': { type: 'western', models: [] },
  'Circle Y': { type: 'western', models: [] },
  Crates: { type: 'western', models: [] },
  'Dale Chavez': { type: 'western', models: [] },
  'Martin Saddlery': { type: 'western', models: [] },
  Reinsman: { type: 'western', models: [] },
  Tucker: { type: 'western', models: [] },
  // Catch-all
  Other: { type: 'both', models: [] }
};

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const BY_NORM = new Map(Object.entries(CATALOG).map(([name, info]) => [norm(name), info]));

/** Brand type/models from the catalog; brands not in it show for every discipline with no suggestions. */
export function brandInfo(name: string): BrandInfo {
  return BY_NORM.get(norm(name)) ?? { type: 'both', models: [] };
}

/** Brands that make saddles for this discipline (English brands for English disciplines, etc.). */
export function brandsForDiscipline<T extends { name: string }>(brands: T[], d: Discipline | '' | null): T[] {
  const kind = kindFor(d);
  const list = kind && kind !== 'any' ? brands.filter((b) => ['both', kind].includes(brandInfo(b.name).type)) : brands;
  // "Other" always last
  return [...list].sort((a, b) => (norm(a.name) === 'other' ? 1 : norm(b.name) === 'other' ? -1 : a.name.localeCompare(b.name)));
}

/** Model names to suggest for a brand, limited to ones built for the chosen discipline. */
export function modelsFor(brandName: string | undefined, d: Discipline | '' | null): string[] {
  if (!brandName) return [];
  return brandInfo(brandName)
    .models.filter((m) => typeof m === 'string' || !d || m.for.includes(d))
    .map((m) => (typeof m === 'string' ? m : m.name));
}

/** Brand names to insert into the `brands` table (kept in sync with the migration). */
export const CATALOG_BRAND_NAMES = Object.keys(CATALOG);

/**
 * What to call a saddle when the seller doesn't know the model, so titles still read naturally
 * ("17" Stubben Close Contact"). Saved in the model field, and shown as blank when editing.
 */
export const GENERIC_MODEL: Record<string, string> = {
  hunter_jumper: 'Close Contact',
  dressage: 'Dressage',
  all_purpose: 'All Purpose',
  eventing: 'Eventing',
  pony_child: 'Pony',
  western: 'Western',
  endurance: 'Endurance'
};

/** True when the model field just holds the generic name for its discipline (model unknown). */
export function isGenericModel(model: string | null | undefined, discipline: string | null | undefined): boolean {
  return !!model && !!discipline && GENERIC_MODEL[discipline]?.toLowerCase() === model.trim().toLowerCase();
}
