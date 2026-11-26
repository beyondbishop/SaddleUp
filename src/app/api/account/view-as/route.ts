// POST /api/account/view-as { view: 'member' | 'admin' }   real admins only
// Lets an admin see the site exactly as a regular member does (admin links, banners and pages
// hidden), and switch back. It only ever removes access: the cookie is ignored for non-admins.
import { NextResponse } from 'next/server';
import { getViewer, VIEW_AS_COOKIE } from '@/lib/roles';

export async function POST(req: Request) {
  const { user, realAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!realAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const res = NextResponse.json({ ok: true, view: body.view === 'member' ? 'member' : 'admin' });
  if (body.view === 'member') {
    res.cookies.set(VIEW_AS_COOKIE, 'member', { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 30 });
  } else {
    res.cookies.delete(VIEW_AS_COOKIE);
  }
  return res;
}
