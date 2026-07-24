import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DISCIPLINE_LABELS } from '@/lib/types';

const DISCIPLINE_ICONS: Record<string, string> = {
  hunter_jumper: '🏇',
  dressage: '🎗️',
  all_purpose: '🐴',
  western: '🤠',
  pony_child: '🎠',
  endurance: '🏔️',
  eventing: '🚩'
};

export default async function HomePage() {
  const supabase = createClient();
  const { data: brands } = await supabase.from('brands').select('name, slug').limit(12);

  return (
    <div>
      <section className="py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-saddle-gold text-xs font-semibold tracking-[0.2em] uppercase mb-4">
            The Fitted Saddle Marketplace
          </p>
          <h1 className="font-serif text-5xl leading-tight text-saddle-brown mb-4">
            The saddle that fits — your horse, and your budget.
          </h1>
          <p className="text-lg mb-8 text-saddle-brown/80">
            Every used saddle on SaddleUp is matched to your horse's back and your own
            measurements — so you stop guessing and start riding. Sellers keep 80%+ of every sale.
          </p>
          <Link
            href="/match"
            className="inline-block bg-saddle-green text-white px-6 py-3 rounded-md font-semibold"
          >
            Find My Fit
          </Link>
        </div>

        <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-saddle-tan/50">
          <img
            src="/images/hero-saddle.jpg"
            alt="English saddle on a horse"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      <section className="py-8">
        <h2 className="text-2xl font-semibold mb-4">Shop by Discipline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(DISCIPLINE_LABELS).map(([key, label]) => (
            <Link
              key={key}
              href={`/saddles?discipline=${key}`}
              className="bg-white border border-saddle-tan rounded-lg p-5 text-center hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="text-3xl mb-2">{DISCIPLINE_ICONS[key]}</div>
              <p className="font-medium text-saddle-brown">{label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-8">
        <h2 className="text-2xl font-semibold mb-4">Shop by Brand</h2>
        <div className="flex flex-wrap gap-3">
          {brands?.map((b) => (
            <Link
              key={b.slug}
              href={`/saddles?brand=${b.slug}`}
              className="bg-white border border-saddle-tan rounded-full px-4 py-2 text-sm hover:shadow-md transition"
            >
              {b.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
