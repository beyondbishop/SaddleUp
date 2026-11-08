import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminQuickAdd from '@/components/AdminQuickAdd';
import { getViewer } from '@/lib/roles';
import { brandsForPicker } from '@/lib/brands-server';

export const metadata = { title: 'Add a saddle you found', robots: { index: false } };

export default async function NewImportPage() {
  const { supabase, user, isImporter, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/imports/new');
  if (!isImporter) redirect('/');

  const brands = await brandsForPicker(supabase, { userId: user.id, isAdmin });

  return (
    <div className="py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h1 className="font-serif text-3xl text-saddle-ink">Add a saddle you found</h1>
        <Link href="/imports" className="text-sm underline text-saddle-brown">My imports →</Link>
      </div>
      <p className="text-saddle-muted mb-6 max-w-2xl">
        Paste a saddle you found (Facebook post, ad, text) and add photos of the stamp or post if you have them. We&apos;ll
        fill in the details, you check them, and you get a listing plus a claim link and message to send the seller.
        The saddle shows on SaddleUp right away (kept out of Google until claimed), and buyer messages about it go to SaddleUp so we can pass them on. Saddle photos go on the listing so the seller starts with them. Please keep messages personal.
      </p>
      <AdminQuickAdd brands={brands} fromFounder={isAdmin} siteUrl={process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') ? 'https://saddleup.me' : process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me'} />
    </div>
  );
}
