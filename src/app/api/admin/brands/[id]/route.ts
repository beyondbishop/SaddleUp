// PATCH /api/admin/brands/<id>
//   { action: 'approve', name?: string }     approve a brand someone added, optionally fixing its spelling
//   { action: 'merge', into: number }         it's a duplicate: move its listings to an existing brand, then delete it
// Admins only.

import { NextResponse } from 'next/server';
import slugify from 'slugify';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: unknown; into?: unknown };
  const admin = createAdminClient();

  if (body.action === 'approve') {
    const update: Record<string, unknown> = { approved: true };
    if (typeof body.name === 'string' && body.name.trim()) {
      const name = body.name.replace(/\s+/g, ' ').trim().slice(0, 60);
      const base = slugify(name, { lower: true, strict: true }) || 'brand';
      const { data: clash } = await admin.from('brands').select('id').or(`slug.eq.${base},name.ilike.${name.replace(/[,()%*]/g, '')}`).neq('id', id).limit(1);
      if (clash?.length) return NextResponse.json({ error: 'A brand with that name already exists. Merge into it instead.' }, { status: 409 });
      update.name = name;
      update.slug = base;
    }
    const { error } = await admin.from('brands').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'merge') {
    const into = Number(body.into);
    if (!Number.isInteger(into) || into === id) return NextResponse.json({ error: 'Pick the brand to merge into.' }, { status: 400 });
    const moves = await Promise.all([
      admin.from('listings').update({ brand_id: into }).eq('brand_id', id),
      admin.from('saved_searches').update({ brand_id: into }).eq('brand_id', id)
    ]);
    const failed = moves.find((m) => m.error);
    if (failed) return NextResponse.json({ error: failed.error!.message }, { status: 500 });
    const { error } = await admin.from('brands').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
}
