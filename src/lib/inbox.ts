// The inbox, grouped by person. Conversations are stored one per saddle + buyer (so inquiries about
// an unclaimed saddle can move to its seller when they claim it), but people think in terms of who
// they're talking to. Here every conversation with the same other person becomes one thread.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { getSellerChips } from '@/lib/avatar';

export interface InboxSaddle {
  conversationId: string;
  listingId: string;
  slug: string | null;
  label: string;
  image: string | null;
  priceCents: number | null;
  status: string | null;
  /** This conversation is about my unclaimed saddle (admins): pass it on to the real seller. */
  unclaimedForMe: boolean;
}

export interface InboxMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface InboxThread {
  otherId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  isSaddleUp: boolean;
  /** They sell on SaddleUp (they're the seller in at least one of these conversations). */
  isSeller: boolean;
  saddles: InboxSaddle[];
  /** The conversation with the newest message (where a reply goes by default). */
  latestConversationId: string;
  lastMessage: InboxMessage | null;
  lastAt: string;
  unread: number;
}

export function saddleLabel(l: { seat_size?: number | string | null; model?: string | null; brands?: { name?: string } | null } | null) {
  if (!l) return 'Saddle';
  const brand = l.brands?.name && l.brands.name !== 'Other' ? `${l.brands.name} ` : '';
  return `${l.seat_size ? `${l.seat_size}" ` : ''}${brand}${l.model ?? 'saddle'}`.trim();
}

/** All of my threads, newest first, with the messages of every conversation in them. */
export async function loadInbox(supabase: SupabaseClient, userId: string) {
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, buyer_id, seller_id, created_at, listings(id, slug, model, seat_size, status, price_cents, images, brands(name)), messages(id, conversation_id, sender_id, body, created_at, read_at)')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

  const convos = (conversations ?? []) as any[];
  const otherIds = Array.from(new Set(convos.map((c) => (c.buyer_id === userId ? c.seller_id : c.buyer_id)).filter(Boolean)));
  const [chips, { data: admins }] = await Promise.all([
    getSellerChips(otherIds),
    otherIds.length
      ? createAdminClient().from('profiles').select('id').in('id', otherIds).eq('is_admin', true)
      : Promise.resolve({ data: [] as { id: string }[] })
  ]);
  const adminIds = new Set((admins ?? []).map((a) => a.id));

  const byOther = new Map<string, { thread: InboxThread; messages: InboxMessage[] }>();
  for (const c of convos) {
    const otherId: string | null = c.buyer_id === userId ? c.seller_id : c.buyer_id;
    if (!otherId) continue;
    const chip = chips[otherId];
    let entry = byOther.get(otherId);
    if (!entry) {
      entry = {
        thread: {
          otherId,
          name: chip?.firstName ?? 'Member',
          initials: chip?.initials ?? '?',
          avatarUrl: chip?.avatarUrl ?? null,
          isSaddleUp: adminIds.has(otherId),
          isSeller: false,
          saddles: [],
          latestConversationId: c.id,
          lastMessage: null,
          lastAt: c.created_at,
          unread: 0
        },
        messages: []
      };
      byOther.set(otherId, entry);
    }
    const l = c.listings;
    if (c.seller_id === otherId) entry.thread.isSeller = true;
    entry.thread.saddles.push({
      conversationId: c.id,
      listingId: l?.id ?? '',
      slug: l?.slug ?? null,
      label: saddleLabel(l),
      image: Array.isArray(l?.images) && typeof l.images[0] === 'string' ? l.images[0] : null,
      priceCents: l?.price_cents ?? null,
      status: l?.status ?? null,
      unclaimedForMe: l?.status === 'unclaimed' && c.seller_id === userId
    });
    for (const m of (c.messages ?? []) as InboxMessage[]) {
      entry.messages.push(m);
      if (!m.read_at && m.sender_id !== userId) entry.thread.unread++;
    }
  }

  const threads: { thread: InboxThread; messages: InboxMessage[] }[] = [];
  for (const entry of Array.from(byOther.values())) {
    entry.messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = entry.messages[entry.messages.length - 1] ?? null;
    if (last) {
      entry.thread.lastMessage = last;
      entry.thread.lastAt = last.created_at;
      entry.thread.latestConversationId = last.conversation_id;
    }
    // Saddles in the order they were last talked about, newest first.
    const lastFor = (id: string) => entry.messages.filter((m) => m.conversation_id === id).pop()?.created_at ?? '';
    entry.thread.saddles.sort((a, b) => lastFor(b.conversationId).localeCompare(lastFor(a.conversationId)));
    threads.push(entry);
  }
  threads.sort((a, b) => b.thread.lastAt.localeCompare(a.thread.lastAt));
  return threads;
}

/** "3:42 PM" today, "Mon" this week, "Nov 20" this year, "Nov 20, 2025" before that. */
export function shortWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  const tz = 'America/New_York';
  const day = (x: Date) => x.toLocaleDateString('en-US', { timeZone: tz });
  if (day(d) === day(now)) return d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  const ageDays = (now.getTime() - d.getTime()) / 86_400_000;
  if (ageDays < 6) return d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
  const sameYear = d.toLocaleDateString('en-US', { timeZone: tz, year: 'numeric' }) === now.toLocaleDateString('en-US', { timeZone: tz, year: 'numeric' });
  return d.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
