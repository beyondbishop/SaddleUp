// POST /api/messages/notify { messageId }   Called right after someone sends a message.
// Emails (and, if they agreed, texts) the other person in the conversation. Only the sender can trigger it.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyNewMessage } from '@/lib/message-alerts';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { messageId } = await req.json().catch(() => ({}));
  if (typeof messageId !== 'string') return NextResponse.json({ ok: false }, { status: 400 });
  await notifyNewMessage(messageId, user.id);
  return NextResponse.json({ ok: true });
}
