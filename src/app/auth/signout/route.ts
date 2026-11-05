// POST /auth/signout — signs the user out on the server (clears the session cookies) and goes home.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  await createClient().auth.signOut();
  return NextResponse.redirect(new URL('/', req.url), { status: 303 });
}
