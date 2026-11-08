// POST /api/account/notification-prefs { key, on }   Turn one kind of notification on or off.
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { PREF_KEYS, toPrefs, type PrefKey } from '@/lib/notification-prefs';

export async function POST(req: Request) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { key, on } = await req.json().catch(() => ({}));
  if (!PREF_KEYS.includes(key as PrefKey) || typeof on !== 'boolean') return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: p, error } = await admin.from('profiles').select('notification_prefs').eq('id', user.id).single();
  if (error) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 });
  const prefs = { ...toPrefs(p?.notification_prefs), [key]: on };
  const { error: saveError } = await admin.from('profiles').update({ notification_prefs: prefs }).eq('id', user.id);
  if (saveError) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 });
  return NextResponse.json({ ok: true, prefs });
}
