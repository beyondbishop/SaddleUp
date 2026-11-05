// POST /api/parse-listing  { text: string }
// Reads pasted listing text into form fields. Uses Claude when ANTHROPIC_API_KEY is set,
// otherwise (or if the AI call fails) the rule-based reader. Signed-in users only, since
// each AI read costs money.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiParseListing, aiReaderConfigured } from '@/lib/ai-parse-listing';
import { parseListingText, summarizeFill } from '@/lib/parse-listing-text';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Paste some text first.' }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: 'That’s too long — paste just the one listing.' }, { status: 400 });
  }

  const { data: brands } = await supabase.from('brands').select('id, name');

  if (aiReaderConfigured() && brands?.length) {
    try {
      const { prefill } = await aiParseListing(text, brands);
      return NextResponse.json({ prefill, ...summarizeFill(prefill), reader: 'ai' });
    } catch (e) {
      console.error('AI listing reader failed; using rules instead', e);
    }
  }

  const parsed = parseListingText(text, brands ?? []);
  return NextResponse.json({ ...parsed, reader: 'rules' });
}
