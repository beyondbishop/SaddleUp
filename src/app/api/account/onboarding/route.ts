// POST /api/account/onboarding { intent?, disciplines?, done? }
// Saves the welcome-step answers. done: true marks onboarding finished (or skipped).
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { ALL_DISCIPLINES, INTENTS, type Intent } from '@/lib/onboarding';

export async function POST(req: Request) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (body.intent !== undefined) {
    if (!INTENTS.includes(body.intent as Intent)) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
    update.member_intent = body.intent;
  }
  if (body.disciplines !== undefined) {
    if (!Array.isArray(body.disciplines)) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
    update.disciplines = [...new Set(body.disciplines)].filter((d) => ALL_DISCIPLINES.includes(d as any));
  }
  if (body.done === true) update.onboarded_at = new Date().toISOString();
  if (!Object.keys(update).length) return NextResponse.json({ ok: true });

  const { error } = await createAdminClient().from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
