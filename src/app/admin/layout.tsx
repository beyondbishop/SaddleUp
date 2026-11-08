import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/roles';
import AdminNav from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin');
  if (!isAdmin) redirect('/');

  const [{ count }, brands] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('brands').select('id', { count: 'exact', head: true }).eq('approved', false)
  ]);

  return (
    <div className="pt-6">
      <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold mb-2">Admin</p>
      <AdminNav pendingCount={count ?? 0} brandsPending={brands.error ? 0 : brands.count ?? 0} />
      {children}
    </div>
  );
}
