// PATCH /api/admin/users/<id> { is_importer?, is_admin? }   admins only
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const changes: Record<string, boolean> = {};
  if (typeof body.is_importer === 'boolean') changes.is_importer = body.is_importer;
  if (typeof body.is_admin === 'boolean') {
    if (params.id === user.id && !body.is_admin) {
      return NextResponse.json({ error: "You can't remove your own admin access." }, { status: 400 });
    }
    changes.is_admin = body.is_admin;
  }
  if (!Object.keys(changes).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from('profiles')
    .update(changes)
    .eq('id', params.id)
    .select('id, email, is_admin, is_importer')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not change access.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  console.info(`Access changed by ${user.email}: ${data.email} → admin=${data.is_admin} importer=${data.is_importer}`);
  return NextResponse.json({ is_admin: data.is_admin, is_importer: data.is_importer });
}
