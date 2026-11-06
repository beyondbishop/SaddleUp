// GET /llms.txt — a plain-text summary of SaddleUp for AI assistants and answer engines
// (the llms.txt convention): what the site is, how it works, and its most useful pages.
// Rebuilt hourly so counts and links stay current.

import { createClient } from '@supabase/supabase-js';
import { SITE_URL, DISCIPLINE_INTROS, brandPath, disciplinePath } from '@/lib/seo';
import { DISCIPLINE_LABELS, type Discipline } from '@/lib/types';
import { SELLER_FEE_PERCENT, SELLER_KEEPS_PERCENT } from '@/lib/fees';

export const revalidate = 3600;

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: listings } = await supabase
    .from('listings')
    .select('slug, model, seat_size, price_cents, discipline, brands(name, slug)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);

  const byDiscipline = new Map<Discipline, number>();
  const byBrand = new Map<string, { name: string; count: number }>();
  for (const l of listings ?? []) {
    byDiscipline.set(l.discipline as Discipline, (byDiscipline.get(l.discipline as Discipline) ?? 0) + 1);
    const b = l.brands as unknown as { name: string; slug: string } | null;
    if (b && b.slug !== 'other') byBrand.set(b.slug, { name: b.name, count: (byBrand.get(b.slug)?.count ?? 0) + 1 });
  }

  const lines = [
    '# SaddleUp',
    '',
    `> SaddleUp (saddleup.me) is a US marketplace for buying and selling used English and Western horse saddles. Every listing includes the exact seat size and tree width (or western bar type), so riders can shop by fit for their horse and themselves. Buyers pay no commission, sellers keep ${SELLER_KEEPS_PERCENT}% of the sale during the beta (a ${SELLER_FEE_PERCENT}% fee), and every purchase includes a 5-day inspection period with payment held until the buyer confirms the saddle fits.`,
    '',
    '## Key pages',
    `- [Browse all saddles](${SITE_URL}/saddles): filter by discipline, brand, seat size, tree width, panels (wool flocked, foam, CAIR) and price`,
    `- [Find My Fit](${SITE_URL}/match): narrows saddles to the tree widths and seat sizes likely to fit, from the horse's back width and the rider's measurements`,
    `- [Sell a saddle](${SITE_URL}/dashboard/listings/new)`,
    '',
    '## Saddles by discipline',
    ...(Object.keys(DISCIPLINE_LABELS) as Discipline[]).map(
      (d) => `- [${DISCIPLINE_INTROS[d].heading}](${SITE_URL}${disciplinePath(d)}): ${byDiscipline.get(d) ?? 0} listed now`
    ),
    ...(byBrand.size
      ? ['', '## Saddles by brand', ...Array.from(byBrand, ([slug, b]) => `- [Used ${b.name} saddles](${SITE_URL}${brandPath(slug)}): ${b.count} listed now`)]
      : []),
    ...(listings?.length
      ? [
          '',
          '## Newest listings',
          ...listings.slice(0, 25).map((l) => {
            const brand = (l.brands as unknown as { name: string } | null)?.name;
            return `- [${l.seat_size}" ${brand && brand !== 'Other' ? `${brand} ` : ''}${l.model}](${SITE_URL}/saddles/${l.slug}): ${DISCIPLINE_LABELS[l.discipline as Discipline]}, $${Math.round(l.price_cents / 100).toLocaleString('en-US')}`;
          })
        ]
      : []),
    '',
    '## Policies',
    `- [Terms](${SITE_URL}/terms)`,
    `- [Privacy](${SITE_URL}/privacy)`,
    `- [Seller agreement](${SITE_URL}/seller-agreement)`,
    ''
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
  });
}
