// Server-only: reads pasted saddle-listing text with Claude and returns structured listing fields.
// Needs ANTHROPIC_API_KEY. Callers fall back to the rule-based reader (parse-listing-text.ts)
// when the key is missing or anything goes wrong, so pasting never breaks.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { ListingPrefill } from './ebay/map';
import { brandInfo, modelsFor } from './saddle-catalog';

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
    // Claude allows at most 16 nullable fields in a schema, so these few use 0 / '' for "unknown".
    zip: z.string(),
    condition: z.enum(CONDITIONS).nullable(),
    year_manufactured: z.number(),
    color: z.string().nullable(),
    panel_type: z.string().nullable(),
    trial_policy: z.enum(['local_trial', 'trial', 'no_trial']).nullable(),
    panel_flocking: z.enum(['wool', 'foam', 'cair']).nullable(),
    tree_width_cm: z.number(),
    panel_length_cm: z.number(),
    description: z.string(),
    warnings: z.array(z.string()),
    photo_findings: z.array(z.string()),
    photo_kinds: z.array(z.enum(['saddle', 'stamp', 'screenshot', 'other'])),
    model_candidates: z.array(z.string()),
    post_spelling_fixes: z.array(z.string())
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
- city / state / zip: where the saddle is located. state as the two-letter US code (null if not given); city null if not given; zip only if a 5-digit US ZIP code is given, otherwise an empty string.
- condition: new (never used), excellent (like new, mint, barely used), good (very good, great shape, some normal wear), fair (well used, needs work/reflocking, noticeable wear). null if not described.
- year_manufactured: only if the text gives the saddle's year; 0 when unknown.
- tree_width_cm / panel_length_cm: measurements in cm when the text or a stamp gives them; 0 when unknown.
- color: leather color as a short label, adding the plain color when the maker's name isn't obvious (e.g. "Havana (dark brown)", "Black", "Brown").
- panel_type: flap/panel details, short and consistent (e.g. "Monoflap, 2AAR flap, D3D 4030 panels", "Long flap", "Wool flocked").
- panel_flocking: what the panels are stuffed with. wool = wool flocked / wool panels / reflockable; foam = foam or latex panels; cair = CAIR or air panels (Bates/Wintec). null if not stated.
- trial_policy: whether the seller allows a trial ride before buying. local_trial = trial only in person/locally; trial = trial offered including shipped trials (or not limited to local); no_trial = no trials, sale only ("no trials", "sold as is", "first come first served, no holds or trials"). null if trials aren't mentioned.
- warnings: short notes for anything the seller must check because the text disagrees with itself or is unclear - e.g. two different prices ("Two prices in the post: $3,950 and $4,250 - check the price"), two different locations, a seat size or tree that conflicts. Use the value you think is the asking price/location for the field and explain the conflict here. Empty list when nothing conflicts.

description: write the listing ad buyers will read on SaddleUp. Make it compelling, warm and easy to scan, like a good saddle-shop listing, while staying honest.
- Open with a 1-2 sentence hook that sells the saddle on its real strengths: the brand and model, the most useful fact for a buyer (one owner, barely used, popular size, wool panels, extras included) and who it suits (e.g. "a great fit for the hunter ring or jumper who wants close contact").
- Facts must come from the post or the photos (e.g. condition you can see, what's included). You may add widely known, general facts about the brand or model (e.g. "Pessoa saddles are known for their secure, balanced close contact feel") but never invent specs, history, measurements or condition. If the condition is mixed, say so plainly ("light wear on the seat and cantle, consistent with careful use") - buyers trust honest listings.
- Leave out anything another field or the site already covers: price, location, shipping, delivery and pickup, and trials. SaddleUp handles shipping and the seller picks trial options on the form, so don't write a Shipping section.
- Drop marketplace page clutter, including Facebook's delivery options ("Public meetup", "Door pickup", "Door dropoff"), "Listed ... ago in ...", "Details", "Message seller", "Is this still available?".
- After the hook, short sections each starting with a label line ("Highlights", "Specifications", "Condition", "Included"), each followed by lines starting with "• ". Specifications: brand/model, seat, tree, flap, panels, serial number, year when known. Skip a section that would be empty.
- Plain text only - no markdown, asterisks or # headings, no emoji, no exclamation-mark hype. One way of writing each thing (17.5", Havana). About 60-150 words.

Photos: you may also get photos of the saddle and/or screenshots of the post. The listing text may then be short or empty. Photos are there to fill in what the post leaves out, so read them closely and fill every field you can support.
- Treat text in a screenshot of the post exactly like pasted listing text.
- Stamps: look for the maker's stamp, plate, tag or sticker (under the flap, on the skirt, by the stirrup bar, on the panel or the cantle) and read everything on it: seat size, tree width or gullet, flap size/length, panel size, serial number, date or year code, model. Read brand logos and nameplates on the cantle, flap, pommel or stirrup bar cover.
- Tree from a stamp: letter codes map directly (N = narrow, MN = medium_narrow, M = medium, MW = medium_wide, W = wide, XW/XXW = x_wide). A gullet or tree measurement in cm (e.g. "31", "32 cm", "T32") goes in tree_width_cm; also set tree_width from it when you know that maker's size chart well, otherwise leave tree_width null and add a warning such as "Stamp shows a 32 cm tree - pick the width". Maker words ("normale", "regular", "large") follow the tree rules above. A changeable gullet system you can see (e.g. a gullet plate or Easy-Change) = adjustable.
- panel_length_cm from a panel size on the stamp or text, in cm.
- Flap code from a stamp (e.g. "2A", "3L", "+2 forward") goes in panel_type, along with what you can see: monoflap, long or short flap, forward or straight flap, knee blocks.
- discipline may come from the saddle's shape when it's clear: forward flap close contact = hunter_jumper, long straight flap with deep seat = dressage, horn and fenders = western, moderately forward flap = all_purpose.
- year_manufactured from a date stamp, or from a serial or date code only when you know that maker's format.
- color from the photos. condition from the photos when the leather is clearly visible: excellent (no visible wear), good (normal wear, some marks on seat or flaps), fair (cracking, scuffs through the finish, torn stitching, very worn). Mention what you saw in photo_findings.
- Never guess a seat size from how the saddle looks.
- Model: the form needs one, so never leave it blank when you know the brand. Use the post or anything legible on the saddle first. If the model name is missing or a stamp is unreadable, still give your best guess: compare the saddle's look (cantle shape and plate, knee/thigh blocks, flap cut, stitching, panels, seat depth) and its discipline with that maker's line-up, using the known models listed with the brands where given. Put the most likely model in model and add a warning like "Model is a best guess from the photos (Gen X by its blocks and cantle) - please confirm or pick another".
- The seller's text wins. If a photo clearly disagrees with the text (stamp says 17, post says 17.5), keep the text's value and add a warning naming both.
- Put stamp details with no field of their own (serial number, date code, flap size) in the description's Specifications section, only as facts you can read.
- photo_findings: one short note per thing you read or saw in the photos and used, e.g. "Stamp: 17.5 seat, MW tree, 2A flap, serial 0412" or "Condition: light wear on seat and knee rolls". Empty list when there were no photos or nothing useful in them.
- model_candidates: when the model isn't stated in the text or clearly legible on the saddle, up to 3 likely model names for this brand, best first (the first one matching model). Empty list when the model is certain.
- post_spelling_fixes: misspellings in the seller's post of the brand or model (or other words buyers search for) that would stop the post showing up in searches, as "wrong → right", e.g. "Pesoa → Pessoa". Only real misspellings of searchable names, not grammar or style. Empty list when there are none.
- photo_kinds: one entry per photo, in the order sent: saddle (shows the saddle or a part of it), stamp (close-up of a stamp, plate or tag), screenshot (a screenshot of the post, a message or a web page), other. Empty list when no photos were sent.`;

export interface AiParseResult {
  prefill: ListingPrefill;
  warnings: string[];
  photoFindings: string[];
  /** One per photo sent: what it shows. Screenshots shouldn't go on the listing. */
  photoKinds: ('saddle' | 'stamp' | 'screenshot' | 'other')[];
  /** Likely models when the model was a guess, best first. */
  modelCandidates: string[];
  /** Searchable names the seller misspelled in their post, as "wrong → right". */
  spellingFixes: string[];
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

  const client = new Anthropic({ timeout: photos.length ? 55_000 : 45_000, maxRetries: photos.length ? 0 : 1 });
  const brandList = brands
    .map((b) => {
      const info = brandInfo(b.name);
      const kind = info.type === 'western' ? 'western' : info.type === 'english' ? 'english' : 'any';
      const models = modelsFor(b.name, null);
      return `${b.name} (${kind}${models.length ? `; known models: ${models.join(', ')}` : ''})`;
    })
    .join('\n');

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
            text: `Allowed brands:\n${brandList}\n\n${photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} attached above.\n\n` : ''}<listing>\n${text.trim() || '(no text pasted - use the photos)'}\n</listing>`
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
  const year = out.year_manufactured >= 1950 && out.year_manufactured <= new Date().getFullYear()
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
      location_zip: out.zip && /^\d{5}$/.test(out.zip.trim()) ? out.zip.trim() : null,
      tree_width_cm: out.tree_width_cm >= 20 && out.tree_width_cm <= 45 ? Math.round(out.tree_width_cm * 10) / 10 : null,
      panel_length_cm: out.panel_length_cm >= 30 && out.panel_length_cm <= 80 ? Math.round(out.panel_length_cm * 10) / 10 : null
    },
    warnings: out.warnings.filter((w) => w.trim()).slice(0, 5),
    photoFindings: out.photo_findings.filter((f) => f.trim()).slice(0, 10),
    photoKinds: photos.map((_, i) => out.photo_kinds[i] ?? 'saddle'),
    spellingFixes: out.post_spelling_fixes.map((f) => f.trim().slice(0, 80)).filter(Boolean).slice(0, 3),
    modelCandidates: [...new Set(out.model_candidates.map((m) => m.trim().slice(0, 80)).filter(Boolean))].slice(0, 3)
  };
}
