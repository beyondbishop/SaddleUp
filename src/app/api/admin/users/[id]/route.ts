// PATCH  /api/admin/users/<id> { is_importer?, is_admin? }            admins only
// POST   /api/admin/users/<id> { action: 'freeze' | 'unfreeze' | 'send_login' }
// DELETE /api/admin/users/<id>                                         permanent
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';
import { sendLoginLink } from '@/lib/login-link';

// Supabase has no "forever" ban, so freezing bans sign-in for ~100 years.
const FREEZE = '876000h';

async function guard(id: string) {
  const { user, isAdmin } = await getViewer();
  if (!user) return { fail: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) };
  if (!isAdmin) return { fail: NextResponse.json({ error: 'Admins only.' }, { status: 403 }) };
  if (!isUuid(id)) return { fail: NextResponse.json({ error: 'User not found.' }, { status: 404 }) };
  return { user };
}

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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, fail } = await guard(params.id);
  if (fail) return fail;
  const { action } = await req.json().catch(() => ({}));
  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(params.id);
  if (!target?.user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  const email = target.user.email;

  if (action === 'freeze' || action === 'unfreeze') {
    const freeze = action === 'freeze';
    if (freeze && params.id === user.id) return NextResponse.json({ error: "You can't freeze yourself." }, { status: 400 });
    const { data, error } = await admin.auth.admin.updateUserById(params.id, { ban_duration: freeze ? FREEZE : 'none' });
    if (error) return NextResponse.json({ error: 'Could not change this account.' }, { status: 500 });
    let hidden = 0;
    if (freeze) {
      // Take their live saddles off the site. They go back to drafts, so the seller can relist
      // them after being unfrozen. Saddles mid-sale (pending_sale) are left alone.
      const { data: rows } = await admin.from('listings').update({ status: 'draft' }).eq('seller_id', params.id).eq('status', 'active').select('id');
      hidden = rows?.length ?? 0;
    }
    console.info(`${freeze ? 'Frozen' : 'Unfrozen'} by ${user.email}: ${email}${hidden ? ` (${hidden} listings hidden)` : ''}`);
    return NextResponse.json({ frozen: freeze && !!data.user?.banned_until, hidden });
  }

  if (action === 'send_login') {
    if (target.user.banned_until && new Date(target.user.banned_until) > new Date()) {
      return NextResponse.json({ error: 'This account is frozen. Unfreeze it first.' }, { status: 400 });
    }
    const result = await sendLoginLink(params.id);
    if (result.status === 'skipped') return NextResponse.json({ error: 'Email isn’t set up yet (Resend), so nothing was sent.' }, { status: 503 });
    if (result.status === 'failed') {
      console.error('Sign-in link email failed', email, result.detail);
      return NextResponse.json({ error: `Could not send: ${result.detail}` }, { status: 502 });
    }
    console.info(`Sign-in link sent by ${user.email} to ${email}`);
    return NextResponse.json({ sent: true, email });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { user, fail } = await guard(params.id);
  if (fail) return fail;
  if (params.id === user.id) return NextResponse.json({ error: "You can't delete yourself." }, { status: 400 });
  const admin = createAdminClient();

  // Orders, imports and rewards are money and history records we must keep, so anyone with
  // them can only be frozen. (The database would refuse the delete anyway.)
  const count = async (q: any) => ((await q).count ?? 0) as number;
  const [asBuyer, asSeller, imports, rewards] = await Promise.all([
    count(admin.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', params.id)),
    count(admin.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', params.id)),
    count(admin.from('listing_imports').select('listing_id', { count: 'exact', head: true }).eq('importer_id', params.id)),
    count(admin.from('importer_rewards').select('order_id', { count: 'exact', head: true }).eq('importer_id', params.id))
  ]);
  const history = [
    asBuyer + asSeller && `${asBuyer + asSeller} order${asBuyer + asSeller === 1 ? '' : 's'}`,
    imports && `${imports} import${imports === 1 ? '' : 's'}`,
    rewards && `${rewards} reward${rewards === 1 ? '' : 's'}`
  ].filter(Boolean);
  if (history.length) {
    return NextResponse.json({ error: `This person has ${history.join(', ')} on record, so they can't be deleted. Freeze them instead.` }, { status: 409 });
  }

  const { data: target } = await admin.auth.admin.getUserById(params.id);
  if (!target?.user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Their saddles come off the site first; the delete then unlinks them from the listing.
  await admin.from('listings').update({ status: 'removed' }).eq('seller_id', params.id).neq('status', 'sold');
  // Removes the sign-in, and with it their profile, saved lists, conversations and messages.
  const { error } = await admin.auth.admin.deleteUser(params.id);
  if (error) {
    console.error('Delete user failed', target.user.email, error.message);
    return NextResponse.json({ error: 'Could not delete this person. Freeze them instead.' }, { status: 500 });
  }
  console.info(`Deleted by ${user.email}: ${target.user.email}`);
  return NextResponse.json({ deleted: true });
}
