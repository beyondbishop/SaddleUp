// Usage:
//   node --env-file=.env.local scripts/seed-listings.mjs saddles.csv            (creates listings)
//   node --env-file=.env.local scripts/seed-listings.mjs saddles.csv --dry-run  (checks the CSV only)
//
// For saddles you find one by one (Facebook Marketplace, groups, barn boards): you copy each
// saddle's details into a row of the CSV by hand — no scraping. This script creates a HIDDEN
// listing for each row plus a private claim link. You send each seller their link in a personal
// message. Nothing is public until the seller claims it, adds their own photos and saves it,
// and it then passes the normal admin review.
//
// CSV columns (header row required). Required: brand, model, discipline, seat_size, tree_width, price
// Optional: seller_name, seller_email, source_url (e.g. the Facebook post — for your records only),
//           city, state, description, condition, image_url (only if the seller sent you the photo
//           themselves and it's hosted somewhere permanent — never a Facebook image link)
//
// discipline: hunter_jumper, dressage, all_purpose, western, pony_child, endurance, eventing
//             (or the plain names: Hunter/Jumper, Dressage, All Purpose, ...)
// tree_width: x_narrow, narrow, medium_narrow, medium, medium_wide, wide, x_wide, adjustable
//             (or MW, Medium/Wide, Medium Narrow, XW, ...)
//
// Output: claim-invites.csv — one row per saddle with the claim link and a draft message to paste.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import slugify from 'slugify';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me').replace(/\/$/, '');

if (!csvPath) {
  console.error('Usage: node --env-file=.env.local scripts/seed-listings.mjs path/to/saddles.csv [--dry-run]');
  process.exit(1);
}

const DISCIPLINES = {
  hunter_jumper: 'Hunter/Jumper', dressage: 'Dressage', all_purpose: 'All Purpose', western: 'Western',
  pony_child: 'Pony/Child', endurance: 'Endurance', eventing: 'Eventing'
};
const TREES = {
  x_narrow: 'X-Narrow', narrow: 'Narrow', medium_narrow: 'Medium/Narrow', medium: 'Medium',
  medium_wide: 'Medium/Wide', wide: 'Wide', x_wide: 'X-Wide', adjustable: 'Adjustable'
};
const TREE_ALIASES = { mw: 'medium_wide', mn: 'medium_narrow', xw: 'x_wide', xn: 'x_narrow', med: 'medium', m: 'medium', w: 'wide', n: 'narrow', xxw: 'x_wide' };
const DISCIPLINE_ALIASES = { hunter: 'hunter_jumper', jumper: 'hunter_jumper', jump: 'hunter_jumper', close_contact: 'hunter_jumper', cc: 'hunter_jumper', gp: 'all_purpose', ap: 'all_purpose', general_purpose: 'all_purpose', pony: 'pony_child', child: 'pony_child', kids: 'pony_child', event: 'eventing', trail: 'endurance' };

const key = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const pickEnum = (value, labels, aliases) => {
  const k = key(value);
  if (labels[k]) return k;
  const byLabel = Object.entries(labels).find(([, label]) => key(label) === k);
  return byLabel?.[0] ?? aliases[k] ?? null;
};
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const isFacebookImage = (u) => /fbcdn\.net|facebook\.com|fbsbx\.com/i.test(u);

const rows = parse(fs.readFileSync(csvPath), { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_quotes: true });

const supabase =
  dryRun
    ? null
    : (() => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local');
          process.exit(1);
        }
        return createClient(url, serviceKey);
      })();

let brands = [];
if (supabase) {
  const { data, error } = await supabase.from('brands').select('id, name');
  if (error) {
    console.error('Could not load brands:', error.message);
    process.exit(1);
  }
  brands = data;
}
const otherBrand = brands.find((b) => key(b.name) === 'other');

const results = [];
const problems = [];

for (const [i, row] of rows.entries()) {
  const line = i + 2; // header is line 1
  const errs = [];

  const discipline = pickEnum(row.discipline, DISCIPLINES, DISCIPLINE_ALIASES);
  const tree = pickEnum(row.tree_width, TREES, TREE_ALIASES);
  const seat = Number(String(row.seat_size ?? '').replace(/["”in\s]/gi, ''));
  const price = Number(String(row.price ?? '').replace(/[$,\s]/g, ''));

  if (!row.brand) errs.push('brand is empty');
  if (!row.model) errs.push('model is empty');
  if (!discipline) errs.push(`discipline "${row.discipline ?? ''}" not recognised`);
  if (!tree) errs.push(`tree_width "${row.tree_width ?? ''}" not recognised`);
  if (!(seat >= 14 && seat <= 19.5) || (seat * 2) % 1 !== 0) errs.push(`seat_size "${row.seat_size ?? ''}" should be like 17 or 17.5`);
  if (!(price > 0)) errs.push(`price "${row.price ?? ''}" should be a number like 2850`);
  if (row.seller_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.seller_email)) errs.push(`seller_email "${row.seller_email}" looks wrong`);

  let images = [];
  if (row.image_url) {
    if (isFacebookImage(row.image_url)) {
      console.warn(`Line ${line}: ignoring Facebook image link — the seller adds their own photos when they claim.`);
    } else if (/^https:\/\//.test(row.image_url)) {
      images = [row.image_url];
    } else {
      errs.push('image_url must start with https://');
    }
  }

  if (errs.length) {
    problems.push(`Line ${line} (${row.brand ?? '?'} ${row.model ?? ''}): ${errs.join('; ')}`);
    continue;
  }

  let brand = brands.find((b) => key(b.name) === key(row.brand));
  let model = row.model;
  if (!brand && supabase) {
    // Unknown brand: file under "Other" and keep the brand name in the model so nothing is lost.
    brand = otherBrand;
    model = `${row.brand} ${row.model}`;
    console.warn(`Line ${line}: brand "${row.brand}" isn't in SaddleUp's brand list — saved under "Other".`);
  }

  const saddle = `${seat}" ${row.brand} ${row.model}`;

  if (dryRun) {
    results.push({ row, saddle, claim_url: '(dry run)' });
    continue;
  }

  const slug = `${slugify(`${seat}-${row.brand}-${row.model}`, { lower: true, strict: true })}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      brand_id: brand?.id ?? null,
      model,
      discipline,
      seat_size: seat,
      tree_width: tree,
      price_cents: Math.round(price * 100),
      description: row.description ?? '',
      condition: row.condition || null,
      images,
      location_city: row.city || null,
      location_state: row.state || null,
      slug,
      status: 'unclaimed',
      source: 'seeded'
    })
    .select('id, claim_token')
    .single();

  if (error) {
    problems.push(`Line ${line} (${saddle}): database error — ${error.message}`);
    continue;
  }

  results.push({ row, saddle, claim_url: `${SITE_URL}/claim/${listing.claim_token}` });
}

const message = (r) => {
  const first = (r.row.seller_name ?? '').trim().split(/\s+/)[0];
  return (
    `Hi${first ? ` ${first}` : ''}! I saw your ${r.saddle} for sale. I run SaddleUp, a marketplace where riders ` +
    `search saddles by tree width and seat size. I set up a free listing for yours — if you'd like more buyers ` +
    `to see it, you can claim it here (no cost, no obligation): ${r.claim_url}\n` +
    `If you'd rather not, just ignore this and it never goes public.`
  );
};

if (!dryRun && results.length) {
  const header = 'seller_name,seller_email,source_url,saddle,claim_url,message';
  const body = results
    .map((r) =>
      [r.row.seller_name, r.row.seller_email, r.row.source_url, r.saddle, r.claim_url, message(r)].map(csvCell).join(',')
    )
    .join('\n');
  fs.writeFileSync('claim-invites.csv', `${header}\n${body}\n`);
}

console.log(
  dryRun
    ? `Dry run: ${results.length} row(s) look good, ${problems.length} need fixing. Nothing was saved.`
    : `Created ${results.length} hidden listing(s). Claim links + message drafts are in claim-invites.csv.`
);
if (problems.length) {
  console.log('\nRows skipped:');
  for (const p of problems) console.log(`  - ${p}`);
}
if (!dryRun && results.length) {
  const withEmail = results.filter((r) => r.row.seller_email).length;
  console.log(
    `\nSend each link in a personal message (Messenger for Facebook sellers). ` +
      (withEmail ? `${withEmail} row(s) have an email — send-claim-invites.mjs can email those.` : '')
  );
}
