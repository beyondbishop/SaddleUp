// GET  /api/lists?listing=<id>   the buyer's active lists, with counts and whether <id> is on each
// POST /api/lists { name, description?, listingId? }   create a list (and optionally save a saddle to it)
import { NextResponse } from 'next/server';
import {
  requireUser, unauthorized, bad, ensureDefaultList, cleanName, cleanText, isUuid, DUPLICATE_NAME
} from '@/lib/lists-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorized();
  await ensureDefaultList(supabase, user.id);

  const listingId = new URL(req.url).searchParams.get('listing');
  const [{ data: lists, error }, { data: memberships }] = await Promise.all([
    supabase
      .from('buyer_lists')
      .select('id, name, description, is_default, created_at, buyer_list_items(count)')
      .is('archived_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
    isUuid(listingId)
      ? supabase.from('buyer_list_items').select('list_id').eq('listing_id', listingId)
      : Promise.resolve({ data: [] as { list_id: string }[] })
  ]);
  if (error) return bad('Could not load your lists.', 500);

  const on = new Set((memberships ?? []).map((m) => m.list_id));
  return NextResponse.json({
    lists: (lists ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      isDefault: l.is_default,
      count: l.buyer_list_items?.[0]?.count ?? 0,
      contains: on.has(l.id)
    }))
  });
}

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const name = cleanName(body.name);
  if (!name) return bad('Give your list a name.');

  const { data: list, error } = await supabase
    .from('buyer_lists')
    .insert({ user_id: user.id, name, description: cleanText(body.description, 500) ?? null })
    .select('id, name, description, is_default')
    .single();
  if (error) return error.code === '23505' ? bad(DUPLICATE_NAME, 409) : bad('Could not create the list.', 500);

  if (isUuid(body.listingId)) {
    const { error: addError } = await supabase
      .from('buyer_list_items')
      .upsert({ list_id: list.id, listing_id: body.listingId, user_id: user.id }, { ignoreDuplicates: true });
    if (addError) return bad('List created, but the saddle could not be saved to it.', 500);
  }
  return NextResponse.json({
    list: { id: list.id, name: list.name, description: list.description, isDefault: list.is_default, count: isUuid(body.listingId) ? 1 : 0, contains: isUuid(body.listingId) }
  });
}
