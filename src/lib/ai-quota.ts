// Server-only: lets visitors who aren't signed in use the AI saddle check a few times a day.
// Each AI call (photo read, price check) counts once; a full check is two calls.
//
// Privacy: no IP is stored. ip_hash = sha256(ip + date + secret), so it can only be matched
// within the same day.

import 'server-only';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

const ANON_CALLS_PER_DAY = 12; // about 6 saddle checks

export async function allowAnonymousAiCall(req: Request): Promise<boolean> {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const secret = process.env.VIEW_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const ipHash = createHash('sha256').update(`${ip}|${day}|${secret}`).digest('hex');

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error } = await admin
    .from('ai_check_uses')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if (error) {
    // Table not created yet (20261111_ai_check_uses.sql): allow, but say so in the logs.
    console.error('AI quota check unavailable; allowing anonymous call', error.message);
    return true;
  }
  if ((count ?? 0) >= ANON_CALLS_PER_DAY) return false;
  await admin.from('ai_check_uses').insert({ ip_hash: ipHash });
  return true;
}

export const ANON_LIMIT_MESSAGE =
  "You've checked a few saddles today. Create a free account to keep going, or come back tomorrow.";
