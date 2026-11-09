import type { PublicReview } from '@/lib/reviews';

/** "What riders are saying": 5-star reviews the reviewer agreed to share (first name only). */
export default function Testimonials({ reviews, title = 'What riders are saying' }: { reviews: PublicReview[]; title?: string }) {
  if (!reviews.length) return null;
  return (
    <section className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-11 pb-2" aria-labelledby="testimonials-title">
      <h2 id="testimonials-title" className="font-serif font-medium text-[26px] text-saddle-ink mb-[18px]">{title}</h2>
      <ul className="grid grid-cols-1 min-[700px]:grid-cols-2 min-[1000px]:grid-cols-3 gap-[22px]">
        {reviews.map((r) => (
          <li key={r.id}>
            <figure className="h-full bg-saddle-paper border border-saddle-line rounded-[3px] p-6 flex flex-col">
              <div className="text-amber-500 text-lg tracking-wider" aria-label={`${r.rating} out of 5 stars`}>
                {'★'.repeat(r.rating)}
              </div>
              <blockquote className="font-serif text-[18px] leading-snug text-saddle-ink mt-2 flex-1">
                “{r.comment}”
              </blockquote>
              <figcaption className="text-sm text-saddle-muted mt-4">
                {r.reviewer_first_name ?? 'A rider'}, {r.reviewer_role === 'seller' ? 'sold' : 'bought'}{' '}
                {r.saddle_label ? `a ${r.saddle_label}` : 'a saddle'}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
