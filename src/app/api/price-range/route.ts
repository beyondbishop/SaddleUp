// POST /api/price-range  { brand_id, model, discipline, seat_size, tree_width, condition, ... }
// Suggests a low / typical / high asking price for a saddle using Claude and a web search of
// current used prices. Signed-in users only, since each estimate costs money.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { aiPriceRange, type SaddleDetails } from '@/lib/ai-price-range';
import { aiReaderConfigured } from '@/lib/ai-parse-listing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  if (!aiReaderConfigured()) return NextResponse.json({ error: "Price suggestions aren't switched on yet." }, { status: 503 });

  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const brandId = num(body.brand_id);
  const model = str(body.model, 80);
  if (!brandId && !model) {
    return NextResponse.json({ error: 'Choose the brand (and model if you know it) first.' }, { status: 400 });
  }

  const { data: brand } = brandId ? await supabase.from('brands').select('name').eq('id', brandId).maybeSingle() : { data: null };
  const details: SaddleDetails = {
    brand: brand?.name ?? null,
    model,
    discipline: str(body.discipline, 40),
    seat_size: num(body.seat_size),
    tree_width: str(body.tree_width, 40),
    condition: str(body.condition, 40),
    year_manufactured: num(body.year_manufactured),
    panel_type: str(body.panel_type),
    panel_flocking: str(body.panel_flocking, 40),
    color: str(body.color, 60),
    description: str(body.description, 1500)
  };

  try {
    const range = await aiPriceRange(details);
    return NextResponse.json(range);
  } catch (e) {
    console.error('Price range failed', e);
    const reason = e instanceof Anthropic.APIError ? `${e.status ?? 'network'} ${e.message}`.slice(0, 300) : e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Couldn't estimate a price right now. Try again in a moment.", aiError: reason }, { status: 502 });
  }
}
