// DELETE /api/listings/<id>
// Deletes a listing. Allowed for its seller, for an admin, and for the importer who added it while
// it's still unclaimed. A listing with a sale or reward attached can't be erased (we keep those
// records), so it's marked removed instead: it disappears from the site either way.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const admin = createAdminClient();
  const [{ data: listing }, { data: imp }] = await Promise.all([
    admin.from('listings').select('id, seller_id, status, images').eq('id', params.id).maybeSingle(),
    admin.from('listing_imports').select('importer_id').eq('listing_id', params.id).maybeSingle()
  ]);
  if (!listing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const isSeller = !!listing.seller_id && listing.seller_id === user.id;
  const isItsImporter = !listing.seller_id && imp?.importer_id === user.id;
  if (!isAdmin && !isSeller && !isItsImporter) {
    return NextResponse.json({ error: "You don't have permission to delete this listing." }, { status: 403 });
  }
  if (listing.status === 'pending_sale') {
    return NextResponse.json({ error: 'This saddle has a sale in progress, so it can’t be deleted until the sale is finished or cancelled.' }, { status: 409 });
  }

  const { error } = await admin.from('listings').delete().eq('id', listing.id);
  if (error) {
    // 23503: an order or reward still points at it. Keep the row, hide the listing.
    if (error.code !== '23503') {
      console.error('Listing delete failed', error);
      return NextResponse.json({ error: 'Could not delete the listing.' }, { status: 500 });
    }
    const { error: hideError } = await admin.from('listings').update({ status: 'removed' }).eq('id', listing.id);
    if (hideError) {
      console.error('Listing remove failed', hideError);
      return NextResponse.json({ error: 'Could not delete the listing.' }, { status: 500 });
    }
    return NextResponse.json({ deleted: false, removed: true });
  }

  // Tidy up the photos we stored for it (best effort; photos hosted elsewhere are left alone).
  const marker = '/storage/v1/object/public/saddle-images/';
  const paths = ((listing.images ?? []) as string[])
    .map((url) => (url.includes(marker) ? decodeURIComponent(url.split(marker)[1]) : null))
    .filter((p): p is string => !!p);
  if (paths.length) await admin.storage.from('saddle-images').remove(paths).catch(() => undefined);

  return NextResponse.json({ deleted: true });
}
