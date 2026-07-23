// Usage: node scripts/seed-listings.mjs saddles.csv
//
// This is the compliant version of "pull saddles from Facebook and list them":
// instead of scraping (which breaks FB's terms and republishes people's photos
// without consent), you or a VA manually copy each public post's details into
// this CSV, then this script creates a DRAFT/seeded listing + a unique claim
// link. You reach out to each seller (a normal DM/email, not automated spam)
// with their claim link, and the listing only goes live once they claim it —
// which is also when they've actually agreed to have it listed.
//
// CSV columns (header row required):
// seller_email,seller_name,brand,model,discipline,seat_size,tree_width,price,description,image_url,city,state
//
// discipline must be one of: hunter_jumper,dressage,all_purpose,western,pony_child,endurance,eventing
// tree_width must be one of: x_narrow,narrow,medium_narrow,medium,medium_wide,wide,x_wide,adjustable

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import slugify from 'slugify';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://your-domain.com';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/seed-listings.mjs path/to/saddles.csv');
  process.exit(1);
}

const rows = parse(fs.readFileSync(csvPath), { columns: true, skip_empty_lines: true });
const results = [];

for (const row of rows) {
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .ilike('name', row.brand.trim())
    .maybeSingle();

  const slug = `${slugify(`${row.seat_size}-${row.brand}-${row.model}`, { lower: true, strict: true })}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      brand_id: brand?.id ?? null,
      model: row.model,
      discipline: row.discipline,
      seat_size: Number(row.seat_size),
      tree_width: row.tree_width,
      price_cents: Math.round(Number(row.price) * 100),
      description: row.description ?? '',
      images: row.image_url ? [row.image_url] : [],
      location_city: row.city ?? null,
      location_state: row.state ?? null,
      slug,
      status: 'unclaimed',
      source: 'seeded'
    })
    .select('id, claim_token')
    .single();

  if (error) {
    console.error(`Failed on row for ${row.seller_email}:`, error.message);
    continue;
  }

  results.push({
    seller_email: row.seller_email,
    seller_name: row.seller_name,
    claim_url: `${SITE_URL}/claim/${listing.claim_token}`
  });
}

fs.writeFileSync(
  'claim-invites.csv',
  'seller_email,seller_name,claim_url\n' +
    results.map((r) => `${r.seller_email},${r.seller_name},${r.claim_url}`).join('\n')
);

console.log(`Seeded ${results.length} listings. Invite links written to claim-invites.csv`);
console.log('Send these individually (or via the send-claim-invites.mjs script) — do not bulk-blast.');
