// PATCH /api/lists/<id> { name?, description?, archived? }   rename, describe, archive or restore
import { NextResponse } from 'next/server';
import { requireUser, unauthorized, bad, cleanName, cleanText, isUuid, DUPLICATE_NAME } from '@/lib/lists-server';

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
  if (!Object.keys(changes).length) return bad('Nothing to change.');

  const { data, error } = await supabase
    .from('buyer_lists')
    .update(changes)
    .eq('id', params.id)
    .select('id, name, description, archived_at, is_default')
    .maybeSingle();
  if (error) return error.code === '23505' ? bad(DUPLICATE_NAME, 409) : bad('Could not save the list.', 500);
  if (!data) return bad('List not found.', 404);
  return NextResponse.json({ list: data });
}
