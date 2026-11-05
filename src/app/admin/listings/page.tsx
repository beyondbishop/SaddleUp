import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ModerationCard from '@/components/ModerationCard';

export default async function AdminListingsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/admin/listings');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/');

  const { data: pending } = await supabase
    .from('listings')
    .select('*, brands(name)')
    .eq('status', 'draft')
    .order('created_at', { ascending: true });

  return (
    <div className="py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-saddle-brown">Listings Awaiting Review</h1>
        <a href="/admin/quick-add" className="bg-saddle-green text-saddle-cream px-4 py-2 rounded-sm text-sm font-semibold">
          + Quick add a saddle
        </a>
      </div>
      <div className="space-y-3">
        {pending?.map((l: any) => (
          <ModerationCard key={l.id} listing={l} />
        ))}
        {pending?.length === 0 && <p className="text-gray-500">Nothing waiting on review right now.</p>}
      </div>
    </div>
  );
}
