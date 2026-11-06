import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { criteriaToParams, hasCriteria, parseCriteria, type SearchCriteria } from '@/lib/search';

// Server helpers for named buyer lists. All reads and writes use the signed-in buyer's own
// session, so the database's row-level security decides what they can touch.

export const DEFAULT_LIST_NAME = 'My favorites';

export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export const unauthorized = () => NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Every buyer has a "My favorites" list; create it the first time it's needed. */
export async function ensureDefaultList(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: existing } = await supabase
    .from('buyer_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data: created } = await supabase
    .from('buyer_lists')
    .insert({ user_id: userId, name: DEFAULT_LIST_NAME, is_default: true })
    .select('id')
    .maybeSingle();
  if (created) return created.id as string;
  // Lost a race with another request (or the name is taken by an archived-then-renamed list).
  const { data: again } = await supabase
    .from('buyer_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();
  return (again?.id as string) ?? null;
}

export function cleanName(v: unknown) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
}
export function cleanText(v: unknown, max: number) {
  if (v === null) return null;
  return typeof v === 'string' ? v.trim().slice(0, max) || null : undefined;
}
export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const DUPLICATE_NAME = 'You already have a list with that name.';


/** A list's saved criteria, re-validated (stored JSON is never trusted as-is). */
export function storedCriteria(json: unknown): SearchCriteria | null {
  if (!json || typeof json !== 'object') return null;
  const c = parseCriteria(criteriaToParams(json as SearchCriteria));
  return hasCriteria(c) ? c : null;
}

/** Criteria from a browse-page query string; null when it has no filters. */
export function criteriaFromSearch(search: unknown): SearchCriteria | null {
  if (typeof search !== 'string') return null;
  const c = parseCriteria(new URLSearchParams(search.replace(/^\?/, '')));
  return hasCriteria(c) ? c : null;
}
