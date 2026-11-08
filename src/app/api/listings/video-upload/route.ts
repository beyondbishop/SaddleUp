// POST /api/listings/video-upload  { name: string, type: string, size: number }
// Videos are too big to pass through our server (Vercel caps requests at ~4.5 MB), so this hands
// the browser a one-time signed URL to upload the video straight to Supabase Storage.

import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_VIDEO_MB = 50;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Your session expired — please sign in again.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; type?: unknown; size?: unknown };
  const type = typeof body.type === 'string' ? body.type : '';
  const size = typeof body.size === 'number' ? body.size : 0;
  if (!/^video\/(mp4|quicktime|webm|x-m4v|3gpp)$/.test(type)) {
    return NextResponse.json({ error: 'Please use an MP4 or MOV video (the kind your phone records).' }, { status: 400 });
  }
  if (size <= 0 || size > MAX_VIDEO_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Videos can be up to ${MAX_VIDEO_MB} MB (about a minute of phone video). Try trimming it.` }, { status: 400 });
  }

  const ext = type === 'video/quicktime' ? 'mov' : type === 'video/webm' ? 'webm' : type === 'video/3gpp' ? '3gp' : 'mp4';
  const path = `${user.id}/video-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('saddle-images').createSignedUploadUrl(path);
  if (error || !data) {
    console.error('Video upload URL failed', error);
    return NextResponse.json({ error: 'Couldn’t start the upload. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({
    uploadUrl: data.signedUrl,
    publicUrl: admin.storage.from('saddle-images').getPublicUrl(path).data.publicUrl
  });
}
