import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import MessageThread from '@/components/MessageThread';
import InboxShell from '@/components/messages/InboxShell';
import { claimUrlFor } from '@/lib/claim-message';
import { loadInbox } from '@/lib/inbox';
import { getSellerChips } from '@/lib/avatar';
import { isUuid } from '@/lib/lists-server';

export const metadata = { title: 'Messages' };

// /messages/<conversation id>: everything with the other person in that conversation, across all
// the saddles you've talked about. Replies go to this conversation's saddle unless you switch.
export default async function ConversationPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/messages/${params.id}`);
  if (!isUuid(params.id)) return notFound();

  const inbox = await loadInbox(supabase, user.id);
  const entry = inbox.find((e) => e.thread.saddles.some((s) => s.conversationId === params.id));
  if (!entry) return notFound();
  const { thread, messages } = entry;

  // Opening the thread marks the other person's messages as read (clears the header count).
  // Messages can't be edited by members, so this runs with the service key after the check above.
  if (thread.unread > 0) {
    await createAdminClient()
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('conversation_id', thread.saddles.map((s) => s.conversationId))
      .neq('sender_id', user.id)
      .is('read_at', null);
    thread.unread = 0;
  }
  const meChip = (await getSellerChips([user.id]))[user.id];

  // A shopper asking about an unclaimed saddle: the message came to SaddleUp. Show who added it and
  // where the seller's post is, so the inquiry can be passed on.
  const unclaimed = thread.saddles.find((s) => s.conversationId === params.id && s.unclaimedForMe);
  let importInfo: { source_url: string | null; seller_name: string | null; importer: string | null; claimUrl: string | null } | null = null;
  if (unclaimed) {
    const admin = createAdminClient();
    const [{ data: imp }, { data: tok }] = await Promise.all([
      admin.from('listing_imports').select('source_url, seller_name, profiles(full_name, email)').eq('listing_id', unclaimed.listingId).maybeSingle(),
      admin.from('listing_claim_tokens').select('token').eq('listing_id', unclaimed.listingId).maybeSingle()
    ]);
    const who = (imp as any)?.profiles;
    importInfo = {
      source_url: imp?.source_url ?? null,
      seller_name: imp?.seller_name ?? null,
      importer: who?.full_name || who?.email || null,
      claimUrl: tok?.token ? claimUrlFor(tok.token) : null
    };
  }

  return (
    <InboxShell threads={inbox.map((e) => e.thread)} userId={user.id} activeOtherId={thread.otherId}>
      {importInfo && (
        <div className="m-4 mb-0 bg-saddle-sand border border-saddle-line rounded-lg p-4 text-sm space-y-1">
          <p className="font-semibold text-saddle-ink">Unclaimed saddle: pass this inquiry to the seller</p>
          <p>Seller: {importInfo.seller_name ?? <span className="italic text-saddle-muted">name not recorded</span>}</p>
          {importInfo.source_url ? (
            <p>
              Their post:{' '}
              <a href={importInfo.source_url} target="_blank" rel="noopener noreferrer" className="underline text-saddle-brown break-all">
                {importInfo.source_url}
              </a>
            </p>
          ) : (
            <p className="italic text-saddle-muted">No link to their post was saved.</p>
          )}
          {importInfo.claimUrl && <p>Their claim link: <span className="break-all">{importInfo.claimUrl}</span></p>}
          {importInfo.importer && <p className="text-saddle-muted">Added by {importInfo.importer}</p>}
          <p className="text-saddle-muted">When they claim it, this conversation moves to them.</p>
        </div>
      )}
      <MessageThread
        key={thread.otherId}
        other={{ id: thread.otherId, name: thread.name, initials: thread.initials, avatarUrl: thread.avatarUrl }}
        me={{ id: user.id, name: meChip?.firstName ?? 'You', initials: meChip?.initials ?? '?', avatarUrl: meChip?.avatarUrl ?? null }}
        otherIsSeller={thread.isSeller}
        otherIsSaddleUp={thread.isSaddleUp}
        saddles={thread.saddles}
        initialMessages={messages}
        defaultConversationId={params.id}
      />
    </InboxShell>
  );
}
