import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DISCIPLINE_LABELS } from '@/lib/types';

export default async function HomePage() {
  const supabase = createClient();
  const { data: brands } = await supabase.from('brands').select('name, slug').limit(12);

  return (
    <div>
      <section className="py-16 text-center">
        <p className="text-saddle-gold text-xs font-semibold tracking-[0.2em] uppercase mb-4">
          The Fitted Saddle Marketplace
        </p>
        <h1 className="font-serif text-5xl leading-tight text-saddle-brown mb-4 max-w-3xl mx-auto">
          The saddle that fits — your horse, and your budget.
        </h1>
        <p className="text-lg max-w-2xl mx-auto mb-8 text-saddle-brown/80">
          Every used saddle on SaddleUp is matched to your horse's back and your own
          measurements — so you stop guessing and start riding. Sellers keep 80%+ of every sale.
        </p>
        <Link
          href="/match"
          className="inline-block bg-saddle-green text-white px-6 py-3 rounded-md font-semibold"
        >
          Find My Fit
        </Link>
      </section>

      <section className="py-8">
        <h2 className="text-2xl font-semibold mb-4">Shop by Discipline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(DISCIPLINE_LABELS).map(([key, label]) => (
            <Link
              key={key}
              href={`/saddles?discipline=${key}`}
              className="bg-white border border-saddle-tan rounded-lg p-4 text-center hover:shadow-md transition"
            >
              {label}
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
