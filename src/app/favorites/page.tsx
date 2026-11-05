import { redirect } from 'next/navigation';
import { requireUser, ensureDefaultList } from '@/lib/lists-server';

// Favorites became named lists; old links land on "My favorites".
export default async function FavoritesPage() {
  const { supabase, user } = await requireUser();
  if (!user) redirect('/auth/login?next=/favorites');
  const id = await ensureDefaultList(supabase, user.id);
  redirect(id ? `/lists/${id}` : '/lists');
}
