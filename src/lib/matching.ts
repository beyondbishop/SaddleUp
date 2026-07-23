import { TreeWidth } from './types';

// Mirrors tree_widths_for_horse() in supabase/schema.sql.
// Kept in JS too so the client-side matching form can preview results
// instantly without a round trip.
export function treeWidthsForHorse(backWidthCm: number): TreeWidth[] {
  if (backWidthCm < 28) return ['x_narrow', 'narrow'];
  if (backWidthCm < 30) return ['narrow', 'medium_narrow'];
  if (backWidthCm < 32) return ['medium_narrow', 'medium'];
  if (backWidthCm < 34) return ['medium', 'medium_wide'];
  if (backWidthCm < 36) return ['medium_wide', 'wide'];
  return ['wide', 'x_wide', 'adjustable'];
}

// Mirrors seat_size_for_rider() in supabase/schema.sql.
export function seatSizeRangeForRider(inseamCm: number): [number, number] {
  if (inseamCm < 68) return [16.0, 16.5];
  if (inseamCm < 73) return [16.5, 17.0];
  if (inseamCm < 78) return [17.0, 17.5];
  if (inseamCm < 83) return [17.5, 18.0];
  return [18.0, 19.0];
}

// Convenience conversions since most US users think in inches but tack
// fitting standards run in cm.
export const inchesToCm = (inches: number) => inches * 2.54;
export const cmToInches = (cm: number) => cm / 2.54;

/**
 * Combined matcher: given horse back width + rider inseam (both in cm),
 * return the tree widths and seat size range to filter listings by.
 * This is the core of the "search by horse + human measurements" feature.
 */
export function matchCriteria(opts: { horseBackWidthCm?: number; riderInseamCm?: number }) {
  const treeWidths = opts.horseBackWidthCm != null
    ? treeWidthsForHorse(opts.horseBackWidthCm)
    : undefined;
  const seatRange = opts.riderInseamCm != null
    ? seatSizeRangeForRider(opts.riderInseamCm)
    : undefined;
  return { treeWidths, seatSizeMin: seatRange?.[0], seatSizeMax: seatRange?.[1] };
}
