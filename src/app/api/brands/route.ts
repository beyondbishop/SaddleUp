// POST /api/brands  { name: string, confirm?: boolean }
// Adds a brand that isn't in the list. First call (no confirm) checks the spelling: if it matches
// a brand we have, that brand comes back; if it looks like a misspelling of one we have, or Claude
// knows a different spelling, suggestions come back for the person to pick from. With confirm, the
// brand is added as typed, waiting for an admin to check it (only the person who added it sees it
// in their brand list until then).

import { NextResponse } from 'next/server';
import slugify from 'slugify';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { normBrand, similarBrands } from '@/lib/brands-server';
import { aiBrandCheck } from '@/lib/ai-brand-check';

export const dynamic = 'force-dynamic';

const DAILY_LIMIT = 10;

type Brand = { id: number; name: string; approved?: boolean };

export async function POST(req: Request) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; confirm?: unknown };
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  if (name.length < 2 || name.length > 60 || !/[a-z]/i.test(name)) {
    return NextResponse.json({ error: 'Please type the brand name (2 to 60 letters).' }, { status: 400 });
  }

  const admin = createAdminClient();
  const res = await admin.from('brands').select('id, name, approved');
  const all: Brand[] = res.error ? ((await admin.from('brands').select('id, name')).data ?? []) : (res.data ?? []);
  const findExact = (n: string) => all.find((b) => normBrand(b.name) === normBrand(n));

  const exact = findExact(name);
  if (exact) return NextResponse.json({ brand: { id: exact.id, name: exact.name } });

  if (body.confirm !== true) {
    const suggestions: { id: number | null; name: string }[] = similarBrands(name, all.filter((b) => b.approved !== false)).map((b) => ({ id: b.id, name: b.name }));
    const ai = await aiBrandCheck(name);
    if (ai && normBrand(ai.spelling) !== normBrand(name) && !suggestions.some((s) => normBrand(s.name) === normBrand(ai.spelling))) {
      const known = findExact(ai.spelling);
      suggestions.unshift(known ? { id: known.id, name: known.name } : { id: null, name: ai.spelling });
    }
    if (suggestions.length) return NextResponse.json({ suggestions, known: ai?.known ?? null });
    // Nothing to correct: tell the browser it's fine to add as typed (with Claude's capitalisation).
    return NextResponse.json({ suggestions: [], known: ai?.known ?? null, spelling: ai?.spelling ?? name });
  }

  if (!isAdmin) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await admin.from('brands').select('id', { count: 'exact', head: true }).eq('suggested_by', user.id).gte('created_at', since);
    if ((count ?? 0) >= DAILY_LIMIT) return NextResponse.json({ error: 'You’ve added a lot of brands today. Please pick “Other” for now.' }, { status: 429 });
  }

  const base = slugify(name, { lower: true, strict: true }) || 'brand';
  const taken = new Set(((await admin.from('brands').select('slug').like('slug', `${base}%`)).data ?? []).map((b) => b.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const { data, error } = await admin
    .from('brands')
    .insert({ name, slug, approved: isAdmin, suggested_by: user.id })
    .select('id, name')
    .single();
  if (error || !data) {
    console.error('Brand add failed', error);
    if (error?.code === '23505') {
      const again = (await admin.from('brands').select('id, name').ilike('name', name).maybeSingle()).data;
      if (again) return NextResponse.json({ brand: again });
    }
    return NextResponse.json({ error: 'Couldn’t add that brand right now. Please pick “Other” and mention the brand in the description.' }, { status: 500 });
  }
  return NextResponse.json({ brand: data, added: true });
}
