import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function MessagesPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/messages');

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*, listings(model, seat_size, slug, status, brands(name)), messages(body, created_at, read_at, sender_id)')
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  return (
    <div className="py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Messages</h1>
      <div className="space-y-2">
        {conversations?.map((c: any) => {
          const lastMessage = c.messages?.[c.messages.length - 1];
          const unread = (c.messages ?? []).filter((m: any) => !m.read_at && m.sender_id !== user.id).length;
          return (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className="block bg-white border border-saddle-tan rounded-lg p-4 hover:shadow-md"
            >
              <p className="font-semibold">
                {c.listings?.seat_size}&quot; {c.listings?.brands?.name} {c.listings?.model}
                {c.listings?.status === 'unclaimed' && c.seller_id === user.id && (
                  <span className="ml-2 text-xs bg-saddle-sand text-saddle-muted rounded-full px-2 py-0.5 align-middle">Unclaimed: pass to seller</span>
                )}
                {unread > 0 && <span className="ml-2 text-xs bg-red-700 text-white rounded-full px-2 py-0.5 align-middle">{unread} new</span>}
              </p>
              {lastMessage && <p className="text-sm text-gray-500 truncate">{lastMessage.body}</p>}
            </Link>
          );
        })}
        {conversations?.length === 0 && <p className="text-gray-500">No conversations yet.</p>}
      </div>
    </div>
  );
}
