// Server-only: reads pasted saddle-listing text with Claude and returns structured listing fields.
// Needs ANTHROPIC_API_KEY. Callers fall back to the rule-based reader (parse-listing-text.ts)
// when the key is missing or anything goes wrong, so pasting never breaks.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { ListingPrefill } from './ebay/map';
import { brandInfo } from './saddle-catalog';

export const aiReaderConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const DISCIPLINES = ['hunter_jumper', 'dressage', 'all_purpose', 'eventing', 'pony_child', 'western', 'endurance'] as const;
const TREES = ['x_narrow', 'narrow', 'medium_narrow', 'medium', 'medium_wide', 'wide', 'x_wide', 'adjustable'] as const;
const CONDITIONS = ['new', 'excellent', 'good', 'fair'] as const;

function schemaFor(brandNames: string[]) {
  return z.object({
    discipline: z.enum(DISCIPLINES).nullable(),
    brand: z.enum(brandNames as [string, ...string[]]).nullable(),
    model: z.string().nullable(),
    seat_size: z.number().nullable(),
    tree_width: z.enum(TREES).nullable(),
    price_usd: z.number().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    condition: z.enum(CONDITIONS).nullable(),
    year_manufactured: z.number().nullable(),
    color: z.string().nullable(),
    panel_type: z.string().nullable(),
    description: z.string(),
    warnings: z.array(z.string())
  });
}

// Frozen across requests (only the brand list varies, and it rarely changes) so it caches well.
const SYSTEM = `You read used-saddle listings (Facebook posts, classified ads, texts) and pull out the details for a saddle marketplace's listing form. Return only what the text actually says or makes unambiguous; use null for anything not stated. A wrong value is worse than a blank, because the seller reviews blanks but may not notice a wrong value.

Field guidance:
- discipline: hunter_jumper covers close contact, jumping, equitation, monoflap jump saddles. all_purpose covers GP/AP. pony_child for pony, child or youth saddles. western for any western saddle (pleasure, trail, ranch, barrel, roping, reining, cutting). endurance only when the text says endurance. If the discipline isn't stated, infer it only from a model you are confident is built for one discipline; otherwise null.
- brand: choose from the allowed list only. Match common variants (e.g. "County" = County Saddlery, "Stübben" = Stubben, "Voltaire" = Voltaire Design). If a brand is named that isn't in the list, use "Other" and put the real brand name at the start of model.
- model: the model name only (e.g. "Biarritz", "Spirit", "Park"), without brand, seat size, tree, discipline or condition words.
- seat_size: inches, in half-inch steps between 12 and 19.5 ("17 1/2" = 17.5). null if not given.
- tree_width: English widths map directly. Maker terms for the standard tree ("normal", "normale", "regular", "standard", "arcade normale") = medium; "large"/"wide arcade" = wide. (MW = medium_wide, MN = medium_narrow, XW = x_wide). Changeable/interchangeable gullet systems = adjustable. Western bars: Arabian = narrow, semi-quarter horse (semi-QH, regular) = medium, full quarter horse (full QH) = wide, draft = x_wide, flex/adjustable tree = adjustable. A bare "medium" with no tree/gullet/bars context is not enough - null.
- price_usd: the asking price in whole US dollars ("3.3k" = 3300, "$2,850 OBO" = 2850). Ignore shipping costs, original retail prices and prices of other items. null if no asking price.
- city / state: where the saddle is located. state as the two-letter US code. null if not given.
- condition: new (never used), excellent (like new, mint, barely used), good (very good, great shape, some normal wear), fair (well used, needs work/reflocking, noticeable wear). null if not described.
- year_manufactured: only if the text gives the saddle's year.
- color: leather color as a short label, adding the plain color when the maker's name isn't obvious (e.g. "Havana (dark brown)", "Black", "Brown").
- panel_type: flap/panel details, short and consistent (e.g. "Monoflap, 2AAR flap, D3D 4030 panels", "Long flap", "Wool flocked").
- warnings: short notes for anything the seller must check because the text disagrees with itself or is unclear - e.g. two different prices ("Two prices in the post: $3,950 and $4,250 - check the price"), two different locations, a seat size or tree that conflicts. Use the value you think is the asking price/location for the field and explain the conflict here. Empty list when nothing conflicts.

description: write a clean listing description from the post, for buyers on SaddleUp.
- Use only facts in the post. Don't add claims, opinions or selling points it doesn't make; you may keep the seller's own descriptive claims.
- Drop marketplace page clutter (e.g. "Listed a few seconds ago in ...", "Door pickup", "Details", "Message seller", "Is this still available?"), the price, and the location - those have their own fields.
- Keep useful facts: what the saddle is, condition details, specifications (tree, flap, panels, serial number, date made), what's included, shipping/pickup terms.
- Make it consistent: one way of writing each thing (17.5", Havana), no repeated facts, plain sentences. Plain text only - no markdown, no asterisks or headings with #.
- Shape: a 1-3 sentence summary paragraph, then where useful short sections each starting with a label line ("Specifications", "Condition", "Included", "Shipping") followed by lines starting with "• ". Keep it about as long as the original or shorter.`;

export interface AiParseResult {
  prefill: ListingPrefill;
  warnings: string[];
}

/** Throws on any failure (API error, refusal, unparseable output) — callers fall back to rules. */
export async function aiParseListing(text: string, brands: { id: number; name: string }[]): Promise<AiParseResult> {
  const brandNames = brands.map((b) => b.name);
  if (!brandNames.length) throw new Error('No brands loaded');

  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const brandList = brands
    .map((b) => `${b.name} (${brandInfo(b.name).type === 'western' ? 'western' : brandInfo(b.name).type === 'english' ? 'english' : 'any'})`)
    .join(', ');

  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(schemaFor(brandNames)) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Allowed brands: ${brandList}\n\n<listing>\n${text}\n</listing>`
      }
    ]
  });

  if (response.stop_reason === 'refusal') throw new Error('Model declined to read this text');
  const out = response.parsed_output;
  if (!out) throw new Error(`No structured output (stop_reason: ${response.stop_reason})`);

  const brand = out.brand ? brands.find((b) => b.name === out.brand) : undefined;
  const seat = out.seat_size != null && out.seat_size >= 12 && out.seat_size <= 19.5 ? Math.round(out.seat_size * 2) / 2 : null;
  const price = out.price_usd != null && out.price_usd > 0 && out.price_usd < 100000 ? Math.round(out.price_usd) : null;
  const year = out.year_manufactured != null && out.year_manufactured >= 1950 && out.year_manufactured <= new Date().getFullYear()
    ? Math.round(out.year_manufactured)
    : null;
  const state = out.state && /^[A-Za-z]{2}$/.test(out.state.trim()) ? out.state.trim().toUpperCase() : null;

  return {
    prefill: {
      brand_id: brand?.id ?? null,
      model: (out.model ?? '').slice(0, 80),
      discipline: out.discipline,
      seat_size: seat,
      tree_width: out.tree_width,
      condition: out.condition,
      color: out.color,
      year_manufactured: year,
      panel_type: out.panel_type,
      price,
      description: (out.description.trim() || text.trim()).slice(0, 4000),
      location_city: out.city,
      location_state: state
    },
    warnings: out.warnings.filter((w) => w.trim()).slice(0, 5)
  };
}
