import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminQuickAdd from '@/components/AdminQuickAdd';

export const metadata = { title: 'Quick add' };

export default async function QuickAddPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/admin/quick-add');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/');

  const { data: brands } = await supabase.from('brands').select('id, name').order('name');

  return (
    <div className="py-8">
      <h1 className="font-serif text-3xl text-saddle-ink mb-1">Quick add a saddle</h1>
      <p className="text-saddle-muted mb-6 max-w-2xl">
        Paste a saddle you found (Facebook post, ad, text). We&apos;ll fill in the details, you check them, and you get a
        hidden listing plus a claim link and message to send the seller. Nothing is public until they claim it.
      </p>
      <AdminQuickAdd brands={brands ?? []} siteUrl={process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') ? 'https://saddleup.me' : process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me'} />
    </div>
  );
}
