import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/server';
import BrandReviewRow from '@/components/admin/BrandReviewRow';
import { similarBrands } from '@/lib/brands-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brands', robots: { index: false } };

// Brands sellers and importers added themselves, waiting for a spelling check.
export default async function AdminBrandsPage() {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin/brands');
  if (!isAdmin) redirect('/');
  const admin = createAdminClient();

  const { data: all, error } = await admin.from('brands').select('id, name, slug, approved, suggested_by, created_at').order('name');
  if (error) {
    return (
      <div className="py-6">
        <h1 className="font-serif text-3xl text-saddle-ink mb-2">Brands</h1>
        <p className="text-sm">
          Run <code>supabase/migrations/20261116_brand_suggestions.sql</code> in the Supabase SQL Editor to turn on brands people add themselves.
        </p>
      </div>
    );
  }
  const pending = (all ?? []).filter((b) => !b.approved);
  const approved = (all ?? []).filter((b) => b.approved);

  const ids = pending.map((b) => b.id);
  const suggesterIds = [...new Set(pending.map((b) => b.suggested_by).filter(Boolean))] as string[];
  const [{ data: uses }, { data: people }] = await Promise.all([
    ids.length ? admin.from('listings').select('brand_id, slug, status').in('brand_id', ids) : Promise.resolve({ data: [] as { brand_id: number; slug: string; status: string }[] }),
    suggesterIds.length ? admin.from('profiles').select('id, full_name, email').in('id', suggesterIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] })
  ]);
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));

  return (
    <div className="py-6">
      <h1 className="font-serif text-3xl text-saddle-ink mb-1">Brands</h1>
      <p className="text-saddle-muted text-sm mb-6">
        Brands sellers and importers added because theirs wasn&apos;t listed. They work on those listings right away; approve them
        to put them in search filters and everyone&apos;s brand list. {approved.length} approved brands.
      </p>

      {pending.length === 0 && <p className="text-saddle-muted">No new brands to check.</p>}

      <ul className="space-y-3">
        {pending.map((b) => {
          const listings = (uses ?? []).filter((u) => u.brand_id === b.id);
          const lookalikes = similarBrands(b.name, approved);
          return (
            <li key={b.id} className="bg-white border border-saddle-line rounded p-4 space-y-3">
              <div>
                <p className="font-semibold text-saddle-brown text-lg">{b.name}</p>
                <p className="text-sm text-saddle-muted">
                  Added by {b.suggested_by ? who.get(b.suggested_by) ?? 'someone' : 'someone'} on {new Date(b.created_at).toLocaleDateString('en-US')}
                  {' · '}
                  {listings.length === 0 ? 'not on any listing yet' : (
                    <>on {listings.map((l, i) => (
                      <span key={l.slug}>{i > 0 && ', '}<Link href={`/saddles/${l.slug}`} className="underline">{l.slug}</Link></span>
                    ))}</>
                  )}
                </p>
                {lookalikes.length > 0 && (
                  <p className="text-sm text-amber-800 mt-1">Looks like: {lookalikes.map((l) => l.name).join(', ')}</p>
                )}
              </div>
              <BrandReviewRow brand={{ id: b.id, name: b.name }} others={approved.map(({ id, name }) => ({ id, name }))} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
