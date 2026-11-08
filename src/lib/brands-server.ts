// Server-only: loading brands for pick lists and filters. Brands people add themselves wait for an
// admin to check the spelling (approved = false); until then they only show in the brand list of
// whoever added them (and on any listing already using them), never in search filters.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

type Brand = { id: number; name: string; slug?: string };

/**
 * Brands for a listing form: approved ones, plus ones this person added, plus the listing's
 * current brand (so editing never loses it). Admins see every brand. Works before the
 * 20261116_brand_suggestions.sql migration has run (then every brand is approved).
 */
export async function brandsForPicker(
  supabase: SupabaseClient,
  opts: { userId: string; isAdmin?: boolean; includeId?: number | null }
): Promise<Brand[]> {
  let q = supabase.from('brands').select('id, name').order('name');
  if (!opts.isAdmin) {
    const ors = ['approved.eq.true', `suggested_by.eq.${opts.userId}`];
    if (opts.includeId) ors.push(`id.eq.${Number(opts.includeId)}`);
    q = q.or(ors.join(','));
  }
  const { data, error } = await q;
  if (!error) return data ?? [];
  const { data: all } = await supabase.from('brands').select('id, name').order('name');
  return all ?? [];
}

/** Approved brands only, for search filters, brand pages and the AI reader. */
export async function approvedBrands(supabase: SupabaseClient, cols = 'id, name, slug'): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select(cols).eq('approved', true).order('name');
  if (!error) return (data ?? []) as unknown as Brand[];
  const { data: all } = await supabase.from('brands').select(cols).order('name');
  return (all ?? []) as unknown as Brand[];
}

/** Lowercase, no accents or punctuation: "Henri-de Rivél" → "henri de rivel". */
export const normBrand = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Existing brands that look like a misspelling of `name` (closest first). */
export function similarBrands<T extends { name: string }>(name: string, brands: T[]): T[] {
  const n = normBrand(name);
  const squash = (s: string) => s.replace(/ /g, '');
  return brands
    .map((b) => {
      const m = normBrand(b.name);
      if (m === 'other') return null;
      const d = editDistance(squash(n), squash(m));
      const close = d <= Math.max(1, Math.floor(Math.max(n.length, m.length) / 5));
      const contains = n.length >= 4 && m.length >= 4 && (m.includes(n) || n.includes(m));
      return close || contains ? { b, d } : null;
    })
    .filter((x): x is { b: T; d: number } => !!x)
    .sort((x, y) => x.d - y.d)
    .slice(0, 3)
    .map((x) => x.b);
}
