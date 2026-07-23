import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import MessageThread from '@/components/MessageThread';

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: convo } = await supabase
    .from('conversations')
    .select('*, listings(model, seat_size, slug, brands(name))')
    .eq('id', params.id)
    .single();

  if (!convo || (convo.buyer_id !== user.id && convo.seller_id !== user.id)) return notFound();

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true });

  return (
    <div className="py-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-saddle-brown mb-4">
        {(convo as any).listings?.seat_size}&quot; {(convo as any).listings?.brands?.name}{' '}
        {(convo as any).listings?.model}
      </h1>
      <MessageThread conversationId={params.id} initialMessages={messages ?? []} currentUserId={user.id} />
    </div>
  );
}
