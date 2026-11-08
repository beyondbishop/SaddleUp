import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import MessageThread from '@/components/MessageThread';
import { claimUrlFor } from '@/lib/claim-message';

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: convo } = await supabase
    .from('conversations')
    .select('*, listings(id, model, seat_size, slug, status, brands(name))')
    .eq('id', params.id)
    .single();

  if (!convo || (convo.buyer_id !== user.id && convo.seller_id !== user.id)) return notFound();

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true });

  // Opening the conversation marks the other person's messages as read (clears the header count).
  // Messages can't be edited by members, so this runs with the service key after the check above.
  if (messages?.some((m) => !m.read_at && m.sender_id !== user.id)) {
    await createAdminClient().from('messages').update({ read_at: new Date().toISOString() })
      .eq('conversation_id', params.id).neq('sender_id', user.id).is('read_at', null);
  }

  // A shopper asking about an unclaimed saddle: the message came to SaddleUp. Show who added it and
  // where the seller's post is, so the inquiry can be passed on.
  const listing = (convo as any).listings;
  let importInfo: { source_url: string | null; seller_name: string | null; importer: string | null; claimUrl: string | null } | null = null;
  if (listing?.status === 'unclaimed' && convo.seller_id === user.id) {
    const admin = createAdminClient();
    const [{ data: imp }, { data: tok }] = await Promise.all([
      admin.from('listing_imports').select('source_url, seller_name, profiles(full_name, email)').eq('listing_id', listing.id).maybeSingle(),
      admin.from('listing_claim_tokens').select('token').eq('listing_id', listing.id).maybeSingle()
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
    <div className="py-8 max-w-2xl mx-auto">
      {importInfo && (
        <div className="mb-4 bg-saddle-sand border border-saddle-line rounded-lg p-4 text-sm space-y-1">
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
      <h1 className="text-xl font-bold text-saddle-brown mb-4">
        {(convo as any).listings?.seat_size}&quot; {(convo as any).listings?.brands?.name}{' '}
        {(convo as any).listings?.model}
      </h1>
      <MessageThread conversationId={params.id} initialMessages={messages ?? []} currentUserId={user.id} />
    </div>
  );
}
