// Reviews at the end of a sale. The buyer rates the seller and the experience; the seller rates
// SaddleUp. 5-star reviews the reviewer is happy to share become testimonials on the homepage,
// and buyers' reviews make up a seller's public rating (profile and listings).
import { createAdminClient } from '@/lib/supabase/server';

export type ReviewRole = 'buyer' | 'seller';

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_role: ReviewRole;
  reviewer_first_name: string | null;
  saddle_label: string | null;
  created_at: string;
};

/** Google review link for SaddleUp's Business Profile, shown to every reviewer (never only happy ones). */
export const GOOGLE_REVIEW_URL = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL?.trim() || null;

/** The sale is final: the buyer kept it, or the trial ended and the seller was paid. */
export function saleIsFinal(o: { payout_status?: string | null; confirmed_at?: string | null; kept_at?: string | null }) {
  return o.payout_status === 'transferred' || !!o.confirmed_at || !!o.kept_at;
}

/** "17.5" Devoucoux Chiberta", leaving out a missing or "Other" brand. */
export function saddleLabel(snap: any) {
  const brand = snap?.brands?.name && snap.brands.name !== 'Other' ? `${snap.brands.name} ` : '';
  return `${snap?.seat_size ? `${snap.seat_size}" ` : ''}${brand}${snap?.model ?? 'saddle'}`.trim();
}

const PUBLIC_FIELDS = 'id, rating, comment, reviewer_role, reviewer_first_name, saddle_label, created_at';

/** 5-star reviews with a comment that the reviewer agreed to share, newest first, for the homepage. */
export async function featuredReviews(limit = 6): Promise<PublicReview[]> {
  const { data, error } = await createAdminClient()
    .from('reviews')
    .select(PUBLIC_FIELDS)
    .eq('rating', 5)
    .eq('share_ok', true)
    .eq('hidden', false)
    .not('comment', 'is', null)
    .neq('comment', '')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return []; // e.g. the reviews migration hasn't been run yet
  return (data ?? []) as PublicReview[];
}

/** A seller's public rating from buyers' reviews, and their best shareable quotes. */
export async function sellerRating(sellerId: string) {
  const { data, error } = await createAdminClient()
    .from('reviews')
    .select(`${PUBLIC_FIELDS}, share_ok`)
    .eq('reviewee_id', sellerId)
    .eq('reviewer_role', 'buyer')
    .eq('hidden', false)
    .order('created_at', { ascending: false });
  if (error || !data?.length) return { count: 0, average: null as number | null, quotes: [] as PublicReview[], all: [] as PublicReview[] };
  const average = Math.round((data.reduce((s, r) => s + r.rating, 0) / data.length) * 10) / 10;
  const quotes = data.filter((r) => r.share_ok && r.rating >= 4 && r.comment?.trim()) as PublicReview[];
  return { count: data.length, average, quotes, all: data as PublicReview[] };
}
