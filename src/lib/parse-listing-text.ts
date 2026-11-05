// Pulls listing fields out of free text a seller (or admin) pastes in — a Facebook post, a
// classified ad, a text message. Rule-based: fast, free, and predictable. Anything it can't find
// is left blank for the person to fill in, and the full text becomes the description.

import type { Discipline, TreeWidth, TrialPolicy } from './types';
import type { ListingPrefill } from './ebay/map';
import { brandInfo, modelsFor } from './saddle-catalog';

type Brand = { id: number; name: string };

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

/** Other ways people write brand names → the name in the brands table. */
const BRAND_ALIASES: Record<string, string> = {
  county: 'County Saddlery',
  voltaire: 'Voltaire Design',
  martin: 'Martin Saddlery',
  'kent masters': 'Kent & Masters',
  'kent and masters': 'Kent & Masters',
  hermes: 'Hermes',
  'herm s': 'Hermes',
  stubben: 'Stubben',
  'black country saddles': 'Black Country',
  'bruno': 'Bruno Delgrange',
  'tad': 'Tad Coffin',
  'dale chavez': 'Dale Chavez',
  'big horn': 'Big Horn',
  bighorn: 'Big Horn',
  'circle y': 'Circle Y',
  'billy cook': 'Billy Cook'
};

function findBrand(brands: Brand[], text: string): Brand | null {
  const t = ` ${norm(text)} `;
  const candidates: { brand: Brand; at: number; len: number }[] = [];
  for (const b of brands) {
    const n = norm(b.name);
    if (n === 'other') continue;
    const at = t.indexOf(` ${n} `);
    if (at >= 0) candidates.push({ brand: b, at, len: n.length });
  }
  for (const [alias, name] of Object.entries(BRAND_ALIASES)) {
    const b = brands.find((x) => norm(x.name) === norm(name));
    const at = t.indexOf(` ${alias} `);
    if (b && at >= 0) candidates.push({ brand: b, at, len: alias.length });
  }
  // Earliest mention wins (the saddle being sold is usually named first); longer name breaks ties.
  candidates.sort((a, b) => a.at - b.at || b.len - a.len);
  return candidates[0]?.brand ?? null;
}

export function parseSeat(text: string): number | null {
  const t = text.replace(/(\d{2})\s*(?:1\/2|½)/g, '$1.5').replace(/(\d{2}),5\b/g, '$1.5');
  const patterns = [
    /\bseat(?:\s*size)?\s*[:\-–]?\s*(1[2-9](?:\.5|\.0)?)\b/i,
    /\b(1[2-9](?:\.5|\.0)?)\s*(?:"|”|''|in\b|inch(?:es)?\b)/i,
    /\b(1[2-9](?:\.5|\.0)?)\s*(?:seat|saddle)\b/i,
    // A bare half size like "Isabell 17.5 changeable" is almost always the seat.
    /(?:^|\s)(1[2-9]\.5)(?=[\s,.;!)]|$)/
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const n = Number(m[1]);
      if (n >= 12 && n <= 19.5) return n;
    }
  }
  return null;
}

const WESTERN_WORDS = /\bwestern\b|\bbarrel\b|\broping\b|\broper\b|\breining\b|\branch\b|\bcutting\b|\bhorn\b|\bcinch\b|\bqh bars?\b|quarter horse bars|\bwade\b|\bsquare skirt|round skirt|\bpleasure saddle\b|\btrail saddle\b/i;

export function parseDisciplineText(text: string, brand: Brand | null): Discipline | null {
  const t = text.toLowerCase();
  if (WESTERN_WORDS.test(t) || (brand && brandInfo(brand.name).type === 'western')) return 'western';
  if (/endurance/.test(t)) return 'endurance';
  if (/dressage/.test(t)) return 'dressage';
  if (/eventing|event saddle|cross[\s-]*country|\bxc\b/.test(t)) return 'eventing';
  if (/\bpony\b|\bchild(?:'s|ren'?s)?\b|\bkids?\b|\byouth\b/.test(t)) return 'pony_child';
  if (/jump|hunter|close[\s-]*contact|\bcc\b|monoflap|equitation/.test(t)) return 'hunter_jumper';
  if (/all[\s-]*purpose|general[\s-]*purpose|\bgp\b|\bap\b/.test(t)) return 'all_purpose';
  return null;
}

export function parseTree(text: string, discipline: Discipline | null): TreeWidth | null {
  const t = text.toLowerCase();
  // Western bar types
  if (/semi[\s-]*(?:qh|quarter)/.test(t)) return 'medium';
  if (/full[\s-]*(?:qh|quarter)/.test(t)) return 'wide';
  if (/\barab(?:ian)?\s*(?:bars?|tree)/.test(t)) return 'narrow';
  if (/\bdraft\b|\bdraught\b/.test(t)) return 'x_wide';
  // English widths — look near "tree"/"gullet" first so "medium" elsewhere doesn't count.
  const near = t.match(/(?:tree|gullet|width)[^.\n]{0,25}|[^.\n]{0,25}(?:tree|gullet)/g)?.join(' ') ?? '';
  for (const source of [near, t]) {
    if (/adjustable|interchangeable|changeable|easy[\s-]*change|changeable gullet|cair/.test(source)) return 'adjustable';
    if (/(?:x|extra)[\s-]*wide|\bxw\b/.test(source)) return 'x_wide';
    if (/(?:x|extra)[\s-]*narrow|\bxn\b/.test(source)) return 'x_narrow';
    if (/med(?:ium)?[\s/-]*wide|\bmw\b/.test(source)) return 'medium_wide';
    if (/med(?:ium)?[\s/-]*narrow|\bmn\b/.test(source)) return 'medium_narrow';
    if (/\bwide\b/.test(source)) return 'wide';
    if (/\bnarrow\b/.test(source)) return 'narrow';
    if (/\bnormale?\b|\bstandard\b/.test(source) && source === near) return 'medium';
    if (/\bmedium\b|\bmed\b|\bregular\b/.test(source) && (source === near || discipline)) return 'medium';
  }
  return null;
}

export function parsePrice(text: string): number | null {
  const toNum = (s: string, k?: string) => {
    const n = Number(s.replace(/,/g, ''));
    return k ? n * 1000 : n;
  };
  const patterns: RegExp[] = [
    /\$\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b/i,
    /\b(?:asking|price|priced at|selling for|sale price|obo for)\s*[:\-–]?\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b/i,
    /\b(\d{1,3}(?:,\d{3})+|\d{3,5})\s*(k)?\s*(?:obo|firm|or best offer|usd|dollars)\b/i,
    /\b(\d+(?:\.\d+)?)\s*(k)\b/i,
    // A bare amount ending the post, e.g. "...Like new. 1200"
    /(?:^|[\s.,!])(\d{1,2},\d{3}|\d{3,5})\s*[.!]?\s*$/
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Math.round(toNum(m[1], m[2]));
      if (n >= 50 && n <= 50000) return n;
    }
  }
  return null;
}

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY'
};
const CODES = new Set(Object.values(STATES));

const NOT_CITY = /^(?:seat|tree|saddle|flap|flaps|gullet|size|condition|price|brand|model|great|good|excellent|used|new|the|my|in|near|from|pick|up|located|location|ship|shipping|obo|firm|asking|wide|narrow|medium)$/i;
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function parseLocation(text: string): { city: string | null; state: string | null } {
  const stateNames = Object.keys(STATES)
    .sort((a, b) => b.length - a.length)
    .map((n) => `${titleCase(n)}|${n.toUpperCase()}`)
    .join('|');
  const cityWord = `[A-Z][a-z.'\\-]+`;
  // "Ocala, FL" / "Ocala FL" (code must end the phrase) / "Ocala, Florida" / "Ocala Florida"
  const re = new RegExp(
    `\\b(${cityWord}(?:\\s${cityWord}){0,2}),?\\s+(?:(${stateNames})\\b|([A-Z]{2})(?=\\s*(?:$|[\\n.,;!)]|\\s+\\d{5}\\b|\\s+(?:area|only|pickup|pick)\\b)))`,
    'g'
  );
  for (const m of text.matchAll(re)) {
    const state = m[2] ? STATES[m[2].toLowerCase()] : CODES.has(m[3]) ? m[3] : null;
    if (!state) continue;
    // Drop leading words that aren't part of the city ("Located Wellington" → "Wellington").
    const words = m[1].split(/\s+/);
    while (words.length && NOT_CITY.test(words[0])) words.shift();
    if (!words.length || words.some((w) => NOT_CITY.test(w))) continue;
    return { city: words.join(' '), state };
  }
  // State on its own, e.g. "Located in Kentucky"
  const lone = text.match(new RegExp(`\\b(?:[Ii]n|[Ll]ocated(?: in)?|[Ll]ocation:?)\\s+(${stateNames})\\b`));
  return { city: null, state: lone ? STATES[lone[1].toLowerCase()] : null };
}

export function parseTrial(text: string): TrialPolicy | null {
  const t = text.toLowerCase();
  if (/\bno\s+(?:trials?|test rides?)\b|trials? not (?:available|offered|possible)|\bsold as[\s-]is\b|\bsale only\b/.test(t)) return 'no_trial';
  if (/\blocal\s+trials?\b|trials?\s+(?:available\s+)?(?:locally|local only|in person)|\btrial (?:ride )?(?:at|in) (?:my|our) barn\b/.test(t)) return 'local_trial';
  if (/\btrials?\s+(?:available|ok|welcome|possible|offered)\b|\bshipped trials?\b|\btrial period\b|\b\d+[\s-]day trial\b/.test(t)) return 'trial';
  return null;
}

function parseCondition(text: string): string | null {
  const t = text.toLowerCase();
  if (/brand[\s-]*new|\bnew with tags\b|\bnwt\b|never (?:been )?used/.test(t)) return 'new';
  if (/like[\s-]*new|excellent|mint|barely used|gently used/.test(t)) return 'excellent';
  if (/very good|good condition|great condition|well cared|well kept/.test(t)) return 'good';
  if (/\bfair\b|well[\s-]*used|needs (?:some )?(?:work|repair|reflock)|wear/.test(t)) return 'fair';
  return null;
}

function parseYear(text: string): number | null {
  const m =
    text.match(/^\s*((?:19[89]|20[0-4])\d)\s+[A-Z]/) ??
    text.match(/\b((?:19[89]|20[0-4])\d)\s+model\b/i) ??
    text.match(/\b(?:manufactured|made|built|purchased|bought)\b[^.\n]{0,24}?\b((?:19[89]|20[0-4])\d)\b/i) ??
    text.match(/\b(?:year|made(?: in)?|manufactured|purchased|bought(?: new)?(?: in)?|from|built)\s*[:\-–]?\s*((?:19[89]|20[0-4])\d)\b/i);
  const y = m ? Number(m[1]) : null;
  return y && y <= new Date().getFullYear() ? y : null;
}

function parseColor(text: string): string | null {
  const m = text.match(/\b(dark brown|light brown|havana|chestnut|black|brown|tan|oak|walnut|chocolate|mahogany|toast)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function parsePanel(text: string): string | null {
  const t = text.toLowerCase();
  if (/mono[\s-]*flap/.test(t)) return 'monoflap';
  if (/long flaps?/.test(t)) return 'long flap';
  if (/forward flaps?|\b\d?\+?\s*forward\b/.test(t)) return 'forward flap';
  if (/short flaps?/.test(t)) return 'short flap';
  return null;
}

/** Model: a known model for the brand mentioned in the text, else the words right after the brand name. */
function parseModel(text: string, brand: Brand | null, discipline: Discipline | null): string {
  if (!brand) return '';
  const t = ` ${norm(text)} `;
  const known = modelsFor(brand.name, null)
    .sort((a, b) => b.length - a.length)
    .find((m) => t.includes(` ${norm(m)} `));
  if (known) return known;

  const names = [brand.name, ...Object.entries(BRAND_ALIASES).filter(([, n]) => n === brand.name).map(([a]) => a)];
  for (const name of names) {
    const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\s+([^\\n.,!;:()]{2,40})`, 'i');
    const m = text.match(re);
    if (!m) continue;
    const words = m[1]
      .replace(/\b1[2-9](?:\.5)?\s*(?:"|”|in\b|inch(?:es)?)/gi, ' ')
      .split(/\s+/)
      .filter(
        (w) =>
          w &&
          !/^(saddle|saddles|english|western|pleasure|trail|ranch|barrel|roping|roper|reining|cutting|wade|used|for|sale|selling|with|w\/|in|the|a|an|and|is|it|has|seat|tree|size|condition|excellent|good|great|like|new|brown|black|dressage|jump(ing|er)?|hunter|close|contact|cc|all|purpose|gp|ap|eventing|medium|med|wide|narrow|mw|mn|xw|xn|adjustable|\$.*|\d+.*)$/i.test(
            w
          )
      )
      .slice(0, 3);
    if (words.length) return words.join(' ');
  }
  void discipline;
  return '';
}

const ALL_DISCIPLINES: Discipline[] = ['hunter_jumper', 'dressage', 'all_purpose', 'eventing', 'pony_child', 'western', 'endurance'];

/** A known model built for specific disciplines (e.g. Devoucoux Biarritz → jumping) implies the first one. */
function disciplineFromModel(brand: Brand | null, model: string): Discipline | null {
  if (!brand || !model) return null;
  const fits = ALL_DISCIPLINES.filter((d) => modelsFor(brand.name, d).includes(model));
  // Untagged models fit every discipline, so they tell us nothing.
  return fits.length && fits.length < ALL_DISCIPLINES.length ? fits[0] : null;
}

/** Marketplace page text that gets copied along with a post but isn't part of the listing. */
const CLUTTER = [
  /^listed .*\bago\b.*$/i,
  /^(door pickup|public meetup|pickup|local pickup|details|description|seller information|seller details|message|send seller a message|send|is this still available\??|save|share|see more|see less|hi, is this available\??|today'?s picks)$/i,
  /^\$\s?\d[\d,]*(\.\d\d)?$/,
  /^(?:asking\s+)?price\s*:.*$/i,
  /^\d+ (?:people|person) (?:clicked|saved).*$/i
];

/** Tidies pasted text into a description: drops page clutter and extra blank lines, keeps the seller's words. */
export function cleanDescription(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/\uFEFF/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => !CLUTTER.some((re) => re.test(l)))
    .map((l) => l.replace(/^[*\-–]\s+/, '• '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ParsedListing {
  prefill: ListingPrefill;
  found: string[];
  missing: string[];
  warnings: string[];
}

export function parseListingText(text: string, brands: Brand[]): ParsedListing {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const brand = findBrand(brands, clean);
  const model = spec(clean, 'model')?.slice(0, 80) ?? parseModel(clean, brand, null);
  const discipline = parseDisciplineText(clean, brand) ?? disciplineFromModel(brand, model);
  const { city, state } = parseLocation(clean);

  const prefill: ListingPrefill = {
    brand_id: brand?.id ?? null,
    model,
    discipline,
    seat_size: parseSeat(clean),
    tree_width: parseTree(`tree ${spec(clean, 'tree|tree width|gullet|bars') ?? ''}`, discipline) ?? parseTree(clean, discipline),
    condition: parseCondition(clean),
    color: spec(clean, 'colou?r|leather colou?r') ?? parseColor(clean),
    year_manufactured: parseYear(clean),
    panel_type: [parsePanel(clean), spec(clean, 'flap|flaps|panels?|panel configuration')].filter(Boolean).join(', ') || null,
    price: parsePrice(clean),
    description: cleanDescription(text).slice(0, 4000),
    location_city: city,
    location_state: state,
    trial_policy: parseTrial(clean)
  };

  return { prefill, ...summarizeFill(prefill), warnings: conflictWarnings(clean) };
}

/** Value of a "Key: value" spec line, e.g. "• Model: Chiberta Lab". */
function spec(text: string, keys: string): string | null {
  const m = text.match(new RegExp(`^\\s*(?:[•*\\-–]\\s*)?(?:${keys})\\s*:\\s*(.+?)\\s*$`, 'im'));
  return m ? m[1] : null;
}

/** Things the seller should double-check because the text disagrees with itself. */
function conflictWarnings(text: string): string[] {
  const prices = Array.from(
    new Set(Array.from(text.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d{3,6})(?!\d)/g), (m) => Number(m[1].replace(/,/g, ''))))
  ).filter((n) => n >= 50);
  return prices.length > 1
    ? [`More than one price in the post (${prices.map((p) => `$${p.toLocaleString('en-US')}`).join(' and ')}) — check the price.`]
    : [];
}

/** Which of the key fields a fill found, and which the person still needs to add. */
export function summarizeFill(prefill: ListingPrefill): { found: string[]; missing: string[] } {
  const labels: [keyof ListingPrefill, string][] = [
    ['discipline', 'discipline'],
    ['brand_id', 'brand'],
    ['model', 'model'],
    ['seat_size', 'seat size'],
    ['tree_width', 'tree width'],
    ['price', 'price'],
    ['location_state', 'location']
  ];
  const found = labels.filter(([k]) => prefill[k] != null && prefill[k] !== '').map(([, l]) => l);
  const missing = labels.filter(([k]) => prefill[k] == null || prefill[k] === '').map(([, l]) => l);
  return { found, missing };
}
