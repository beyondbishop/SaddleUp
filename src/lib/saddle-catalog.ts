// Reference data that drives the listing form's pick lists.
// Brands themselves live in the `brands` table (so filters/SEO pages work); this file adds which
// kind of saddle each brand makes and common model names to suggest. Sellers can always type a
// model that isn't listed. To add a brand: insert it in the `brands` table AND add it here.

import type { Discipline, TreeWidth } from './types';

export type SaddleType = 'english' | 'western';

export const SADDLE_TYPE_LABELS: Record<SaddleType, string> = {
  english: 'English',
  western: 'Western'
};

export const DISCIPLINES_BY_TYPE: Record<SaddleType, { value: Discipline; label: string }[]> = {
  english: [
    { value: 'hunter_jumper', label: 'Hunter/Jumper (close contact)' },
    { value: 'dressage', label: 'Dressage' },
    { value: 'all_purpose', label: 'All Purpose' },
    { value: 'eventing', label: 'Eventing' },
    { value: 'pony_child', label: 'Pony/Child' },
    { value: 'endurance', label: 'Endurance' }
  ],
  western: [
    { value: 'western', label: 'Western (pleasure, trail, ranch, barrel, roping…)' },
    { value: 'endurance', label: 'Endurance' }
  ]
};

export function saddleTypeForDiscipline(d: Discipline | null | undefined): SaddleType | null {
  if (!d) return null;
  return d === 'western' ? 'western' : 'english';
}

const halfSteps = (from: number, to: number) => {
  const out: number[] = [];
  for (let n = from; n <= to + 1e-9; n += 0.5) out.push(Math.round(n * 10) / 10);
  return out;
};

/** English seats are measured button-to-cantle (14–19"); Western seats run smaller (12–17"). */
export const SEAT_SIZES: Record<SaddleType, number[]> = {
  english: halfSteps(14, 19),
  western: halfSteps(12, 17)
};

export const formatSeat = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}"`;

/** Western makers describe fit by bar type; each maps to the closest SaddleUp tree width for search. */
export const TREE_OPTIONS: Record<SaddleType, { value: TreeWidth; label: string }[]> = {
  english: [
    { value: 'x_narrow', label: 'X-Narrow' },
    { value: 'narrow', label: 'Narrow' },
    { value: 'medium_narrow', label: 'Medium/Narrow' },
    { value: 'medium', label: 'Medium' },
    { value: 'medium_wide', label: 'Medium/Wide' },
    { value: 'wide', label: 'Wide' },
    { value: 'x_wide', label: 'X-Wide' },
    { value: 'adjustable', label: 'Adjustable / interchangeable gullet' }
  ],
  western: [
    { value: 'narrow', label: 'Arabian bars (narrow)' },
    { value: 'medium', label: 'Semi-Quarter Horse bars (regular)' },
    { value: 'wide', label: 'Full Quarter Horse bars (wide)' },
    { value: 'x_wide', label: 'Draft / extra-wide bars' },
    { value: 'adjustable', label: 'Adjustable / flex tree' }
  ]
};

type BrandInfo = { type: SaddleType | 'both'; models: string[] };

const CATALOG: Record<string, BrandInfo> = {
  // English
  Albion: { type: 'english', models: ['SLK', 'K2', 'Legend', 'Revelation'] },
  Amerigo: { type: 'english', models: ['Vega', 'Pro'] },
  Antares: { type: 'english', models: ['Signature', 'Evolution', 'Spirit', 'Connexion'] },
  Bates: { type: 'english', models: ['Caprilli', 'Isabell', 'Elevation', 'Innova', 'Kimberley', 'All Purpose', 'Pony'] },
  'Black Country': { type: 'english', models: ['Vinici', 'Quantum', 'Eden'] },
  'Bruno Delgrange': { type: 'english', models: [] },
  Butet: { type: 'english', models: [] },
  Childeric: { type: 'english', models: [] },
  'County Saddlery': { type: 'english', models: ['Perfection', 'Innovation', 'Stabilizer', 'Competitor', 'Conquest', 'Fusion', 'Logic'] },
  CWD: { type: 'english', models: ['SE01', 'SE02', '2Gs', 'Mademoiselle'] },
  Devoucoux: { type: 'english', models: ['Biarritz', 'Chiberta', 'Oldara', 'Makila', 'Socoa'] },
  Equiline: { type: 'english', models: [] },
  Equipe: { type: 'english', models: ['Expression', 'Synergy', 'Emporio'] },
  Hermes: { type: 'english', models: ['Steinkraus', 'Oxer', 'Cavale', 'Talaris', 'Corlandus'] },
  'Kent & Masters': { type: 'english', models: [] },
  Kieffer: { type: 'english', models: [] },
  Passier: { type: 'english', models: ['Grand Gilbert', 'Optimum'] },
  Pessoa: { type: 'english', models: ['Gen X', 'A/O', 'Heritage', 'Legacy'] },
  Prestige: { type: 'english', models: ['Roma', 'Meredith', 'X-Breath', 'X-Paris', 'Venus'] },
  Schleese: { type: 'english', models: ['Wave', 'Obrigado', 'JES'] },
  Stubben: { type: 'english', models: ['Genesis', 'Siegfried', 'Portos', 'Edelweiss', 'Juventus', 'Tristan'] },
  'Tad Coffin': { type: 'english', models: ['A5'] },
  Thorowgood: { type: 'english', models: ['T4', 'T6', 'T8'] },
  'Voltaire Design': { type: 'english', models: ['Palm Beach', 'Lexington', 'Blenheim', 'Adelaide', 'Stuttgart'] },
  Wintec: { type: 'english', models: ['500', '2000', 'Pro', 'Isabell', '250'] },
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

/** Brand type/models from the catalog; brands not in it show for both types with no suggestions. */
export function brandInfo(name: string): BrandInfo {
  return BY_NORM.get(norm(name)) ?? { type: 'both', models: [] };
}

export function brandsForType<T extends { name: string }>(brands: T[], type: SaddleType | null): T[] {
  const list = type ? brands.filter((b) => ['both', type].includes(brandInfo(b.name).type)) : brands;
  // "Other" always last
  return [...list].sort((a, b) => (norm(a.name) === 'other' ? 1 : norm(b.name) === 'other' ? -1 : a.name.localeCompare(b.name)));
}

/** Brand names to insert into the `brands` table (kept in sync with the migration). */
export const CATALOG_BRAND_NAMES = Object.keys(CATALOG);
