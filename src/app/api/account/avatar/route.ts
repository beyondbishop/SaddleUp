// POST   /api/account/avatar  (multipart, field "file")  sets the signed-in person's headshot
// DELETE /api/account/avatar                           removes it (back to Google's photo or initials)
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024; // the page shrinks photos to ~512px first, so this is plenty
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function signedIn() {
  const { data: { user } } = await createClient().auth.getUser();
  return user;
}

export async function POST(req: Request) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No photo received.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Please use a JPEG, PNG or WebP photo.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That photo is too large. Please try a smaller one.' }, { status: 400 });

  const admin = createAdminClient();
  const path = `avatars/${user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage.from('saddle-images').upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (upErr) {
    console.error('Headshot upload failed', upErr);
    return NextResponse.json({ error: 'Could not save your photo. Please try again.' }, { status: 500 });
  }
  const url = admin.storage.from('saddle-images').getPublicUrl(path).data.publicUrl;

  const previous = user.app_metadata?.avatar_url as string | undefined;
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { avatar_url: url } });
  if (error) {
    console.error('Headshot save failed', error);
    return NextResponse.json({ error: 'Could not save your photo. Please try again.' }, { status: 500 });
  }
  await removeOld(previous, user.id);
  return NextResponse.json({ url });
}

export async function DELETE() {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const previous = user.app_metadata?.avatar_url as string | undefined;
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: { avatar_url: null } });
  if (error) return NextResponse.json({ error: 'Could not remove your photo.' }, { status: 500 });
  await removeOld(previous, user.id);
  return NextResponse.json({ ok: true });
}

/** Deletes a replaced headshot from storage (only ever one inside this person's own folder). */
async function removeOld(url: string | undefined, userId: string) {
  const marker = `/saddle-images/avatars/${userId}/`;
  const i = url?.indexOf(marker) ?? -1;
  if (!url || i < 0) return;
  await createAdminClient().storage.from('saddle-images').remove([url.slice(i + '/saddle-images/'.length)]).catch(() => {});
}
