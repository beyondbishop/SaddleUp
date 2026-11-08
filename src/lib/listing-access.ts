// Server-only: who may manage a listing (edit, delete, see stats). Its seller, an admin, or the
// importer who added it while it's still unclaimed (no seller yet).

import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';

export type ListingAccess = 'seller' | 'admin' | 'importer';

export async function listingAccess(listingId: string): Promise<{
  user: { id: string } | null;
  isAdmin: boolean;
  access: ListingAccess | null;
}> {
  const { user, isAdmin } = await getViewer();
  if (!user) return { user: null, isAdmin: false, access: null };
  const admin = createAdminClient();
  const [{ data: listing }, { data: imp }] = await Promise.all([
    admin.from('listings').select('seller_id').eq('id', listingId).maybeSingle(),
    admin.from('listing_imports').select('importer_id').eq('listing_id', listingId).maybeSingle()
  ]);
  if (!listing) return { user, isAdmin, access: null };
  const access: ListingAccess | null =
    listing.seller_id && listing.seller_id === user.id
      ? 'seller'
      : isAdmin
        ? 'admin'
        : !listing.seller_id && imp?.importer_id === user.id
          ? 'importer'
          : null;
  return { user, isAdmin, access };
}
