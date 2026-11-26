import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InboxShell from '@/components/messages/InboxShell';
import { loadInbox } from '@/lib/inbox';

export const metadata = { title: 'Messages' };

export default async function MessagesPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/messages');

  const inbox = await loadInbox(supabase, user.id);

  return (
    <InboxShell threads={inbox.map((e) => e.thread)} userId={user.id} activeOtherId={null}>
      <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-saddle-muted">
        {inbox.length ? 'Choose a conversation to read it.' : 'Your conversations with sellers and shoppers will appear here.'}
      </div>
    </InboxShell>
  );
}
