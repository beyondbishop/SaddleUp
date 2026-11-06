// Server-only: estimates a used-saddle price range (low / typical / high) with Claude, grounded in
// a short web search for current used asking and sold prices. If the search tool isn't available
// it answers from its own market knowledge instead.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

export interface SaddleDetails {
  brand: string | null;
  model: string | null;
  discipline: string | null;
  seat_size: number | null;
  tree_width: string | null;
  condition: string | null;
  year_manufactured: number | null;
  panel_type: string | null;
  panel_flocking: string | null;
  color: string | null;
  description: string | null;
}

export interface PriceRange {
  low: number;
  typical: number;
  high: number;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  sources: string[];
  searched: boolean;
}

const RangeSchema = z.object({
  low: z.number(),
  typical: z.number(),
  high: z.number(),
  confidence: z.enum(['low', 'medium', 'high']),
  reasoning: z.string(),
  sources: z.array(z.string())
});

const SYSTEM = `You estimate fair asking prices for used saddles in US dollars, for sellers listing on SaddleUp, a US used-saddle marketplace.

Give three whole-dollar asking prices for this saddle:
- low: priced to sell quickly
- typical: a fair asking price most buyers would accept
- high: top of the market, for excellent condition or a patient seller

How to price:
- Base it on what this brand and model actually sell for used in the US, adjusted for condition, age, seat size and tree (popular sizes like 17-17.5" English seats and medium/medium-wide trees sell more easily; very small or very large seats and unusual trees sell for less), and options like custom flaps or panels.
- Before answering, always run at least one web search for current used listings and sold prices for this make and model (eBay sold listings, saddle consignment shops, used-saddle sites) and weigh them above your own memory, since prices change. Sold prices count more than asking prices.
- New retail price is a ceiling, not a guide: used saddles usually sell well below it.
- Keep low <= typical <= high. Round to sensible asking prices (e.g. 2,450 not 2,437).
- If you don't recognise the model or details are missing, give a wider range and set confidence to low. Never refuse to give a range.

reasoning: two or three plain sentences a seller can read, naming what drove the range (e.g. "Used Biarritz saddles in good condition are listed around $3,000-$4,000; a 17.5" seat sells well; older year pulls it down a bit."). No markdown.
sources: short labels for what you used, e.g. "3 eBay sold listings", "2 consignment shop listings", "General market knowledge". No URLs.`;

function describe(d: SaddleDetails): string {
  const lines = [
    ['Brand', d.brand],
    ['Model', d.model],
    ['Discipline', d.discipline],
    ['Seat size', d.seat_size != null ? `${d.seat_size}"` : null],
    ['Tree', d.tree_width],
    ['Condition', d.condition],
    ['Year', d.year_manufactured],
    ['Flap / panels', d.panel_type],
    ['Flocking', d.panel_flocking],
    ['Color', d.color]
  ]
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`);
  if (d.description?.trim()) lines.push(`Seller's description:\n${d.description.trim().slice(0, 1500)}`);
  return lines.join('\n');
}

async function ask(details: SaddleDetails, withSearch: boolean) {
  const client = new Anthropic({ timeout: withSearch ? 50_000 : 30_000, maxRetries: 0 });
  return client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(RangeSchema) },
    ...(withSearch ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 3 }] } : {}),
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `<saddle>\n${describe(details)}\n</saddle>`
      }
    ]
  });
}

/** Throws on failure. Tries with web search first, then without. */
export async function aiPriceRange(details: SaddleDetails): Promise<PriceRange> {
  let searched = true;
  let response;
  try {
    response = await ask(details, true);
  } catch (e) {
    console.error('Price range with web search failed; trying without', e);
    searched = false;
    response = await ask(details, false);
  }
  if (response.stop_reason === 'refusal') throw new Error('Model declined');
  // Whether a search actually ran (the model can skip it), so the page doesn't overclaim.
  searched = searched && (response.usage.server_tool_use?.web_search_requests ?? 0) > 0;
  const out = response.parsed_output;
  if (!out) throw new Error(`No structured output (stop_reason: ${response.stop_reason})`);

  const round = (n: number) => (n >= 1000 ? Math.round(n / 50) * 50 : Math.round(n / 10) * 10);
  const [low, typical, high] = [out.low, out.typical, out.high].map((n) => Math.max(0, round(n))).sort((a, b) => a - b);
  if (!typical || high > 100_000) throw new Error('Unusable price range');
  return {
    low,
    typical,
    high,
    reasoning: out.reasoning.trim().slice(0, 600),
    confidence: out.confidence,
    sources: out.sources.filter((s) => s.trim()).slice(0, 4),
    searched
  };
}
