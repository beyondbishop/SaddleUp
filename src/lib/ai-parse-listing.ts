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
    zip: z.string().nullable(),
    condition: z.enum(CONDITIONS).nullable(),
    year_manufactured: z.number().nullable(),
    color: z.string().nullable(),
    panel_type: z.string().nullable(),
    trial_policy: z.enum(['local_trial', 'trial', 'no_trial']).nullable(),
    panel_flocking: z.enum(['wool', 'foam', 'cair']).nullable(),
    description: z.string(),
    warnings: z.array(z.string()),
    photo_findings: z.array(z.string())
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
- city / state / zip: where the saddle is located. state as the two-letter US code; zip only if a 5-digit US ZIP code is given. null if not given.
- condition: new (never used), excellent (like new, mint, barely used), good (very good, great shape, some normal wear), fair (well used, needs work/reflocking, noticeable wear). null if not described.
- year_manufactured: only if the text gives the saddle's year.
- color: leather color as a short label, adding the plain color when the maker's name isn't obvious (e.g. "Havana (dark brown)", "Black", "Brown").
- panel_type: flap/panel details, short and consistent (e.g. "Monoflap, 2AAR flap, D3D 4030 panels", "Long flap", "Wool flocked").
- panel_flocking: what the panels are stuffed with. wool = wool flocked / wool panels / reflockable; foam = foam or latex panels; cair = CAIR or air panels (Bates/Wintec). null if not stated.
- trial_policy: whether the seller allows a trial ride before buying. local_trial = trial only in person/locally; trial = trial offered including shipped trials (or not limited to local); no_trial = no trials, sale only ("no trials", "sold as is", "first come first served, no holds or trials"). null if trials aren't mentioned.
- warnings: short notes for anything the seller must check because the text disagrees with itself or is unclear - e.g. two different prices ("Two prices in the post: $3,950 and $4,250 - check the price"), two different locations, a seat size or tree that conflicts. Use the value you think is the asking price/location for the field and explain the conflict here. Empty list when nothing conflicts.

description: write a clean listing description from the post, for buyers on SaddleUp.
- Use only facts in the post. Don't add claims, opinions or selling points it doesn't make; you may keep the seller's own descriptive claims.
- Drop marketplace page clutter (e.g. "Listed a few seconds ago in ...", "Door pickup", "Details", "Message seller", "Is this still available?"), the price, and the location - those have their own fields.
- Keep useful facts: what the saddle is, condition details, specifications (tree, flap, panels, serial number, date made), what's included, shipping/pickup and trial terms.
- Make it consistent: one way of writing each thing (17.5", Havana), no repeated facts, plain sentences. Plain text only - no markdown, no asterisks or headings with #.
- Shape: a 1-3 sentence summary paragraph, then where useful short sections each starting with a label line ("Specifications", "Condition", "Included", "Shipping") followed by lines starting with "• ". Keep it about as long as the original or shorter.

Photos: you may also get photos of the saddle and/or screenshots of the post. The listing text may then be short or empty.
- Treat text in a screenshot of the post exactly like pasted listing text.
- Use the saddle photos to fill fields the text leaves blank. Look for the maker's stamp, plate or tag (usually under the flap, on the skirt, the stirrup bar area or the cantle) and read seat size, tree width or gullet number, flap size, serial number and date/year from it. Read brand logos and nameplates on the cantle, flap or pommel.
- Only fill a field from a photo when it is clearly legible. Never guess a seat size, tree or year from how the saddle looks. Brand from a clear logo or stamp is fine; model only if it is written on the saddle.
- color may come from the photos. condition only when wear is obvious (e.g. cracked or very worn leather = fair); otherwise leave it null.
- The seller's text wins. If a photo clearly disagrees with the text (stamp says 17, post says 17.5), keep the text's value and add a warning naming both.
- Put stamp details that have no field of their own (serial number, date code, flap size) into the description's Specifications section, and only facts you can read.
- photo_findings: one short note per thing you read or saw in the photos that you used, e.g. "Stamp: 17.5 seat, 2A flap, serial 0412" or "Logo on cantle: CWD". Empty list when no photos were sent or nothing useful was readable.`;

export interface AiParseResult {
  prefill: ListingPrefill;
  warnings: string[];
  photoFindings: string[];
}

export type ListingPhoto = { media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string };

/** Throws on any failure (API error, refusal, unparseable output) — callers fall back to rules. */
export async function aiParseListing(
  text: string,
  brands: { id: number; name: string }[],
  photos: ListingPhoto[] = []
): Promise<AiParseResult> {
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
    // Reading stamps in photos benefits from a closer look; plain text stays cheap.
    output_config: { effort: photos.length ? 'medium' : 'low', format: betaZodOutputFormat(schemaFor(brandNames)) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: [
          ...photos.map((p) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: p.media_type, data: p.data } })),
          {
            type: 'text' as const,
            text: `Allowed brands: ${brandList}\n\n${photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} attached above.\n\n` : ''}<listing>\n${text.trim() || '(no text pasted - use the photos)'}\n</listing>`
          }
        ]
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
      location_state: state,
      trial_policy: out.trial_policy,
      panel_flocking: out.panel_flocking,
      location_zip: out.zip && /^\d{5}$/.test(out.zip.trim()) ? out.zip.trim() : null
    },
    warnings: out.warnings.filter((w) => w.trim()).slice(0, 5),
    photoFindings: out.photo_findings.filter((f) => f.trim()).slice(0, 8)
  };
}
