'use client';
import { useState } from 'react';

type Props = {
  orderId: string;
  role: 'buyer' | 'seller';
  /** Stars picked in the email, if they came from there. */
  initialRating?: number | null;
  initial?: { rating: number; comment: string | null; share_ok: boolean } | null;
  googleReviewUrl?: string | null;
};

/** Rate a finished sale: stars, a few words, and whether SaddleUp may quote it. */
export default function ReviewForm({ orderId, role, initialRating, initial, googleReviewUrl }: Props) {
  const [rating, setRating] = useState<number>(initialRating ?? initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [shareOk, setShareOk] = useState(initial?.share_ok ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError('Tap the stars to choose a rating.');
    setSaving(true);
    setError(null);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, rating, comment, shareOk })
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) return setError(json.error ?? 'Could not save your review. Please try again.');
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="font-semibold text-saddle-ink">Thank you! Your review means a lot.</p>
        {rating === 5 && shareOk && comment.trim() && (
          <p className="text-sm text-saddle-muted">With your OK, riders may see it on SaddleUp (first name only).</p>
        )}
        {googleReviewUrl && (
          <div className="bg-saddle-cream border border-saddle-tan rounded p-3 text-sm">
            <p>Would you share your experience on Google too? It helps other riders find SaddleUp.</p>
            <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 font-semibold underline text-saddle-brown">
              Review SaddleUp on Google →
            </a>
          </div>
        )}
      </div>
    );
  }

  const prompt =
    role === 'buyer'
      ? 'How was the saddle, the seller and buying on SaddleUp? Fit, condition, communication…'
      : 'How was selling on SaddleUp? What worked well, and what could be better?';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-1 text-4xl leading-none" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setRating(n)}
            className={n <= rating ? 'text-amber-500' : 'text-gray-300 hover:text-amber-300'}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={prompt}
        rows={4}
        maxLength={2000}
        className="w-full border border-saddle-line rounded p-3 text-sm"
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={shareOk} onChange={(e) => setShareOk(e.target.checked)} className="mt-1" />
        <span>SaddleUp may share my review on its website, with my first name only.</span>
      </label>
      <button type="submit" disabled={saving} className="bg-saddle-green text-white px-5 py-2.5 rounded-md font-semibold text-sm disabled:opacity-50">
        {saving ? 'Sending…' : initial ? 'Update review' : 'Send review'}
      </button>
    </form>
  );
}
