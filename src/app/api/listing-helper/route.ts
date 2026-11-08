// POST /api/listing-helper  { turns: {role, content}[], context: { form, options, findings, warnings, missing } }
// One reply from the listing helper: a short message, field changes for the browser to apply
// to the form, and up to three tap-to-answer replies. Signed-in people only, with a daily cap,
// since each reply costs money.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getViewer } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/server';
import { aiReaderConfigured } from '@/lib/ai-parse-listing';
import { listingHelperReply, type HelperContext, type HelperTurn } from '@/lib/ai-listing-helper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAILY_LIMIT = 80;
const ADMIN_DAILY_LIMIT = 400;
const MAX_TURNS = 30;

const strList = (v: unknown, max: number, len = 400) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max).map((x) => x.slice(0, len)) : [];

function readContext(raw: unknown): HelperContext {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const form: Record<string, string> = {};
  if (c.form && typeof c.form === 'object') {
    for (const [k, v] of Object.entries(c.form as Record<string, unknown>).slice(0, 40)) {
      if (typeof v === 'string' && v.trim()) form[k.slice(0, 40)] = v.slice(0, 5000);
    }
  }
  const options: Record<string, string[]> = {};
  if (c.options && typeof c.options === 'object') {
    for (const [k, v] of Object.entries(c.options as Record<string, unknown>).slice(0, 20)) options[k.slice(0, 40)] = strList(v, 200, 120);
  }
  return { form, options, findings: strList(c.findings, 12), warnings: strList(c.warnings, 8), missing: strList(c.missing, 12, 60) };
}

export async function POST(req: Request) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in to use the helper.' }, { status: 401 });
  if (!aiReaderConfigured()) return NextResponse.json({ error: "The helper isn't switched on yet." }, { status: 503 });

  const body = ((await req.json().catch(() => ({}))) ?? {}) as { turns?: unknown; context?: unknown };
  const turns: HelperTurn[] = (Array.isArray(body.turns) ? body.turns : [])
    .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
    .slice(-MAX_TURNS)
    .map((t: any) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  if (!turns.length || turns[turns.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Say what you’d like to change.' }, { status: 400 });
  }
  // The conversation must start with the person (drop a leading helper greeting if trimmed to it).
  while (turns.length && turns[0].role !== 'user') turns.shift();

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from('ai_helper_uses').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
  if ((count ?? 0) >= (isAdmin ? ADMIN_DAILY_LIMIT : DAILY_LIMIT)) {
    return NextResponse.json({ error: "You've used the helper a lot today. You can still edit the form yourself, and the helper is back tomorrow." }, { status: 429 });
  }
  await admin.from('ai_helper_uses').insert({ user_id: user.id });

  try {
    const reply = await listingHelperReply(turns, readContext(body.context));
    return NextResponse.json(reply);
  } catch (e) {
    console.error('Listing helper failed', e);
    const reason = e instanceof Anthropic.APIError ? `${e.status ?? 'network'} ${e.message}`.slice(0, 300) : e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "The helper couldn't answer just now. Try again in a moment.", aiError: reason }, { status: 502 });
  }
}
