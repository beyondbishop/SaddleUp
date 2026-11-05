// POST /api/listings/upload-image  (multipart form, field "file")
// Uploads one listing photo to Supabase Storage on the server and returns its public URL.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request limit is ~4.5 MB

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Your session expired — please sign in again.' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No photo received.' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: `${file.name} isn't an image.` }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `${file.name} is over 4 MB — please use a smaller photo.` }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);
  const path = `${user.id}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from('saddle-images')
    .upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (error) {
    console.error('Photo upload failed', error);
    return NextResponse.json({ error: `Couldn't upload ${file.name}: ${error.message}` }, { status: 400 });
  }
  return NextResponse.json({ url: supabase.storage.from('saddle-images').getPublicUrl(path).data.publicUrl });
}
