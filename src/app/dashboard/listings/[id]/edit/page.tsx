import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ListingForm from '@/components/ListingForm';

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: brands } = await supabase.from('brands').select('id, name').order('name');
  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', params.id)
    .eq('seller_id', user.id)
    .single();

  if (!listing) return notFound();

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Edit Listing</h1>
      <ListingForm brands={brands ?? []} existing={listing as any} />
    </div>
  );
}
