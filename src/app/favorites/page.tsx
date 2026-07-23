import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SaddleCard from '@/components/SaddleCard';
import { Listing } from '@/lib/types';

export default async function FavoritesPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/favorites');

  const { data } = await supabase
    .from('favorites')
    .select('listing_id, listings(*, brands(name, slug))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const listings = (data?.map((f: any) => f.listings).filter(Boolean) ?? []) as unknown as Listing[];

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Your Favorites</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {listings.map((l) => (
          <SaddleCard key={l.id} listing={l} />
        ))}
      </div>
      {listings.length === 0 && <p className="text-gray-500">No favorites yet — browse saddles and tap the heart.</p>}
    </div>
  );
}
