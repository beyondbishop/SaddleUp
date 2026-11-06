// PATCH /api/lists/<id> { name?, description?, archived?, search? }   rename, describe, archive or restore,
//   or set criteria from a browse-page query string (search: null clears them)
import { NextResponse } from 'next/server';
import { requireUser, unauthorized, bad, cleanName, cleanText, isUuid, DUPLICATE_NAME, criteriaFromSearch } from '@/lib/lists-server';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorized();
  if (!isUuid(params.id)) return bad('List not found.', 404);
  const body = await req.json().catch(() => ({}));

  const changes: Record<string, unknown> = {};
  if ('name' in body) {
    const name = cleanName(body.name);
    if (!name) return bad('Give your list a name.');
    changes.name = name;
  }
  if ('description' in body) changes.description = cleanText(body.description, 500) ?? null;
  if ('archived' in body) changes.archived_at = body.archived ? new Date().toISOString() : null;
  if ('search' in body) {
    changes.criteria = body.search === null ? null : criteriaFromSearch(body.search);
    if (body.search !== null && !changes.criteria) return bad('Pick at least one filter to save.');
    changes.criteria_updated_at = new Date().toISOString();
  }
  if (!Object.keys(changes).length) return bad('Nothing to change.');

  const { data, error } = await supabase
    .from('buyer_lists')
    .update(changes)
    .eq('id', params.id)
    .select('id, name, description, archived_at, is_default, criteria')
    .maybeSingle();
  if (error) return error.code === '23505' ? bad(DUPLICATE_NAME, 409) : bad('Could not save the list.', 500);
  if (!data) return bad('List not found.', 404);
  return NextResponse.json({ list: data });
}
