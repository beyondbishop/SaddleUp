import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { DISCIPLINE_LABELS, TREE_WIDTH_LABELS, Listing, type Discipline } from '@/lib/types';
import { SITE_URL, brandPath, disciplinePath } from '@/lib/seo';
import { SELLER_KEEPS_PERCENT } from '@/lib/fees';

const eyebrow = 'font-mono uppercase text-saddle-gold';
const sectionH2 = 'font-serif font-medium text-[34px] text-saddle-ink m-0';

const TRUST = [
  ['No buyer commission', `You pay the sticker price. Sellers keep ${SELLER_KEEPS_PERCENT}% of every sale during our beta.`],
  ['5-day inspection', "Your payment is held until you confirm the saddle fits — or it's returned."],
  ['Fit-first search', 'Filter by tree width, seat size and discipline — not just brand.']
];

const TESTIMONIALS = [
  {
    quote:
      "I've bought saddles off Facebook before and always held my breath. Here it was three clicks — and knowing it was insured door to door was the reason I actually hit buy.",
    name: 'Megan T.',
    meta: 'Hunter/Jumper · Ocala, FL'
  },
  {
    quote:
      'The insurance is what sold me. A $4k saddle sight-unseen felt insane until I saw my payment was held and the shipment was covered. Fit was perfect, released the funds day four.',
    name: 'Rebecca L.',
    meta: 'Dressage · Lexington, KY'
  },
  {
    quote:
      "Selling was the easy part I didn't expect — listed in ten minutes, buyer covered, and my payout landed automatically once the inspection window closed. No chasing, no risk.",
    name: 'James P.',
    meta: 'Eventing · Aiken, SC'
  }
];

function SectionHeader({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-[26px]">
      <h2 className={sectionH2}>{title}</h2>
      <Link href={href} className={`${eyebrow} text-[11px] tracking-[0.16em] whitespace-nowrap hover:text-saddle-brown`}>
        {cta} →
      </Link>
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const price = (listing.price_cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  const title = `${listing.seat_size}" ${listing.brands?.name ?? ''} ${listing.model}`.replace(/\s+/g, ' ');
  const location = [listing.location_city, listing.location_state].filter(Boolean).join(', ');

  return (
    <Link
      href={`/saddles/${listing.slug}`}
      className="block bg-saddle-paper border border-saddle-line rounded-[3px] overflow-hidden transition-colors hover:border-saddle-brown"
    >
      <div className="relative aspect-[4/3]">
        {listing.images?.[0] ? (
          <Image src={listing.images[0]} alt={title} fill sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 380px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-stripes flex items-center justify-center">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-saddle-brown/40">No photo yet</span>
          </div>
        )}
      </div>
      <div className="px-4 pt-4 pb-[18px]">
        <div className={`${eyebrow} text-[10px] tracking-[0.16em] mb-[7px]`}>{DISCIPLINE_LABELS[listing.discipline]}</div>
        <div className="font-serif text-xl leading-[1.15] text-saddle-ink">{title}</div>
        <div className="text-[13px] text-saddle-muted mt-1">
          {TREE_WIDTH_LABELS[listing.tree_width]} Tree{location ? ` · ${location}` : ''}
        </div>
        <div className="font-serif text-[22px] text-saddle-brown mt-3">{price}</div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const supabase = createClient();
  const [{ data: brands }, { data: listings }, { data: forTiles }] = await Promise.all([
    supabase.from('brands').select('name, slug').order('name').limit(12),
    supabase
      .from('listings')
      .select('*, brands(name, slug)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(6),
    // Every live saddle's discipline + photos (small), for the discipline tiles' photo and count.
    supabase.from('listings').select('discipline, images').eq('status', 'active').order('created_at', { ascending: false })
  ]);

  const tiles = new Map<string, { count: number; photo: string | null }>();
  for (const l of forTiles ?? []) {
    const t = tiles.get(l.discipline) ?? { count: 0, photo: null };
    t.count += 1;
    t.photo ??= l.images?.[0] ?? null; // newest listing with a photo
    tiles.set(l.discipline, t);
  }

  return (
    <div className="full-bleed">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'SaddleUp',
              url: SITE_URL,
              logo: `${SITE_URL}/images/logo.png`,
              description:
                'A marketplace for buying and selling used English and Western saddles, listed by seat size and tree width so riders can shop by fit.'
            },
            { '@context': 'https://schema.org', '@type': 'WebSite', name: 'SaddleUp', url: SITE_URL }
          ])
        }}
      />
      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-12 min-[900px]:pt-[76px] pb-14 grid grid-cols-1 min-[900px]:grid-cols-[1.05fr_0.95fr] gap-9 min-[900px]:gap-16 items-center">
        <div>
          <div className={`${eyebrow} text-[11px] tracking-[0.24em] mb-[22px]`}>The fitted saddle marketplace</div>
          <h1 className="font-serif font-normal text-[34px] sm:text-[42px] min-[900px]:text-[60px] leading-[1.02] tracking-[-0.01em] text-saddle-ink mb-6">
            The saddle that fits — your horse, and your budget.
          </h1>
          <p className="text-lg leading-[1.55] text-saddle-body max-w-[520px] mb-[34px]">
            Every used saddle on SaddleUp is matched to your horse&apos;s back and your own measurements — so you
            stop guessing and start riding. Buyers pay no commission; sellers keep {SELLER_KEEPS_PERCENT}% during our beta.
          </p>
          <div className="flex gap-3.5 flex-wrap">
            <Link
              href="/match"
              className="inline-flex items-center gap-[9px] bg-saddle-green text-saddle-cream px-7 py-[15px] rounded-sm font-semibold text-[14.5px] tracking-[0.02em] transition-colors hover:bg-saddle-green-dark"
            >
              Find My Fit →
            </Link>
            <Link
              href="/saddles"
              className="inline-flex items-center text-saddle-brown border border-saddle-brown px-7 py-[15px] rounded-sm font-semibold text-[14.5px] tracking-[0.02em] transition-colors hover:bg-saddle-brown hover:text-saddle-cream"
            >
              Browse all saddles
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="relative aspect-[4/5] border border-saddle-line rounded-[3px] overflow-hidden bg-saddle-paper">
            <Image
              src="/images/hero-saddle.jpg"
              alt="Brown leather English saddle with gold stirrup on a navy quilted pad"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 540px"
              className="object-cover object-[40%_center]"
            />
          </div>
          <div className="absolute -bottom-[18px] left-0 min-[900px]:-left-[18px] bg-saddle-paper border border-saddle-line rounded-[3px] px-5 py-4 shadow-[0_12px_34px_rgba(60,40,20,0.12)]">
            <div className={`${eyebrow} text-[10px] tracking-[0.18em] mb-1`}>Matched to your horse</div>
            <div className="font-serif text-xl text-saddle-ink">Medium tree · 17.5″ seat</div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-saddle-line bg-saddle-sand">
        <div className="max-w-[1200px] mx-auto px-8 py-[34px] grid grid-cols-1 min-[900px]:grid-cols-3 gap-5 min-[900px]:gap-10">
          {TRUST.map(([title, body], i) => (
            <div key={title} className={i > 0 ? 'min-[900px]:border-l min-[900px]:border-saddle-line min-[900px]:pl-10' : ''}>
              <div className="font-serif text-[23px] text-saddle-brown mb-1">{title}</div>
              <div className="text-sm text-saddle-muted">{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Disciplines */}
      <section className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-16 pb-10">
        <SectionHeader title="Shop by discipline" href="/saddles" cta="View all" />
        <div className="grid grid-cols-2 sm:grid-cols-3 min-[900px]:grid-cols-4 gap-4">
          {Object.entries(DISCIPLINE_LABELS).map(([key, label]) => {
            const tile = tiles.get(key);
            return (
              <Link
                key={key}
                href={disciplinePath(key as Discipline)}
                className="group relative block aspect-[3/4] border border-saddle-line rounded-[3px] overflow-hidden bg-saddle-paper transition-colors hover:border-saddle-brown"
              >
                {tile?.photo ? (
                  <Image
                    src={tile.photo}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, 280px"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-stripes" />
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 pt-12 bg-gradient-to-t from-saddle-ink/80 to-saddle-ink/0">
                  <div className="font-serif text-xl text-saddle-cream">{label}</div>
                  <div className="text-xs text-saddle-cream/85 mt-0.5">
                    {tile ? `${tile.count} saddle${tile.count === 1 ? '' : 's'}` : 'None listed yet'}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Newly listed */}
      {listings && listings.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-9">
          <SectionHeader title="Newly listed" href="/saddles" cta="See all saddles" />
          <div className="grid grid-cols-1 sm:grid-cols-2 min-[900px]:grid-cols-3 gap-[22px]">
            {(listings as Listing[]).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* Brands */}
      {brands && brands.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-11 pb-2">
          <h2 className="font-serif font-medium text-[26px] text-saddle-ink mb-[18px]">Shop by brand</h2>
          <div className="flex flex-wrap gap-[11px]">
            {brands.map((b) => (
              <Link
                key={b.slug}
                href={brandPath(b.slug)}
                className="bg-saddle-paper border border-saddle-line rounded-full px-[18px] py-[9px] text-sm text-saddle-nav transition-colors hover:border-saddle-brown hover:text-saddle-brown"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Why not Facebook */}
      <section className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-16">
        <div className={`${eyebrow} text-[11px] tracking-[0.2em] mb-3`}>Why SaddleUp</div>
        <h2 className={`${sectionH2} mb-3 max-w-[760px]`}>Most saddles are hidden. Yours shouldn&apos;t be.</h2>
        <p className="text-saddle-muted text-[16px] leading-relaxed mb-8 max-w-[720px]">
          Selling on Facebook means your saddle is only seen by whoever happens to scroll past. SaddleUp puts every saddle
          in one open marketplace, so the riders who need yours can actually find it, and buyers can see every option
          and price in one place.
        </p>
        <div className="grid grid-cols-1 min-[800px]:grid-cols-2 gap-5">
          {(
            [
              {
                title: 'Selling on Facebook',
                tone: 'muted',
                points: [
                  'Only people in your groups or nearby see your post.',
                  "Buyers can't search by seat size or tree width.",
                  "Posts are behind logins, so Google and AI assistants can't find them.",
                  'Your post gets buried in a day or two.'
                ]
              },
              {
                title: 'Selling on SaddleUp',
                tone: 'strong',
                points: [
                  'Riders across the US can find your saddle, and we handle the shipping label.',
                  'Buyers search by brand, seat size, tree width and style, so they find yours.',
                  'Built to show up on Google and AI search when riders look for a saddle like yours.',
                  'A level playing field: independent sellers and buyers, every saddle and price in one place.'
                ]
              }
            ] as const
          ).map((col) => (
            <div
              key={col.title}
              className={`rounded-[3px] p-7 border ${
                col.tone === 'strong' ? 'border-saddle-green bg-saddle-paper' : 'border-saddle-line bg-saddle-sand'
              }`}
            >
              <h3 className={`font-serif text-[23px] mb-4 ${col.tone === 'strong' ? 'text-saddle-green' : 'text-saddle-muted'}`}>
                {col.title}
              </h3>
              <ul className="space-y-3">
                {col.points.map((p) => (
                  <li key={p} className="flex gap-3 text-[15px] leading-snug text-saddle-body">
                    <span aria-hidden className={col.tone === 'strong' ? 'text-saddle-green font-semibold' : 'text-saddle-faint'}>
                      {col.tone === 'strong' ? '✓' : '✕'}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="bg-saddle-green text-saddle-cream px-6 py-3.5 rounded-sm font-semibold text-[14.5px] hover:bg-saddle-green-dark"
          >
            List your saddle free →
          </Link>
          <Link href="/about" className="text-sm underline text-saddle-brown">
            Why I built SaddleUp
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mt-[52px] border-t border-saddle-line bg-saddle-sand">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-[60px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 mb-2">
            <h2 className={sectionH2}>Riders who found their fit</h2>
            <div className={`${eyebrow} text-[11px] tracking-[0.16em]`}>4.9 ★ · 1,200+ sales</div>
          </div>
          <p className="text-saddle-muted text-[15px] mb-[30px] max-w-[560px]">
            Every purchase is backed by SaddleUp Protection — full insurance on the saddle in transit and a 5-day
            inspection, so your money is covered until the fit is confirmed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 min-[900px]:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-saddle-paper border border-saddle-line rounded-[3px] p-[26px]">
                <div className="text-saddle-tan text-[15px] tracking-[2px] mb-3.5" aria-label="5 out of 5 stars">★★★★★</div>
                <p className="font-serif text-[19px] leading-[1.4] text-saddle-ink mb-5">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-[38px] h-[38px] rounded-full bg-saddle-tan flex items-center justify-center font-serif text-base text-saddle-brown-deep">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-saddle-ink">{t.name}</div>
                    <div className="text-[12.5px] text-saddle-muted">{t.meta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-[60px] pb-[76px]">
        <div className="bg-saddle-green rounded p-9 min-[900px]:p-14 grid grid-cols-1 min-[900px]:grid-cols-[1fr_auto] gap-[22px] min-[900px]:gap-10 items-center">
          <div>
            <h2 className="font-serif font-normal text-[38px] leading-[1.08] text-saddle-cream mb-3">
              Not sure what fits? Start with two measurements.
            </h2>
            <p className="text-saddle-green-mist text-base max-w-[560px]">
              Enter your horse&apos;s back width and your inseam. We&apos;ll narrow the whole marketplace down to the
              tree widths and seat sizes most likely to fit.
            </p>
          </div>
          <Link
            href="/match"
            className="justify-self-start whitespace-nowrap bg-saddle-cream text-saddle-green px-[30px] py-4 rounded-sm font-semibold text-[15px] tracking-[0.02em] transition-colors hover:bg-saddle-paper"
          >
            Find My Fit →
          </Link>
        </div>
      </section>
    </div>
  );
}
