'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function InquiryBox({ listingId, sellerId }: { listingId: string; sellerId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = `/auth/login?next=/saddles`;
      return;
    }
    if (user.id === sellerId) {
      setError("This is your own listing.");
      setSending(false);
      return;
    }

    // Find or create the conversation for this buyer + listing.
    let { data: convo } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (!convo) {
      const { data: newConvo, error: convoError } = await supabase
        .from('conversations')
        .insert({ listing_id: listingId, buyer_id: user.id, seller_id: sellerId })
        .select('id')
        .single();
      if (convoError) {
        setError(convoError.message);
        setSending(false);
        return;
      }
      convo = newConvo;
    }

    const { error: msgError } = await supabase
      .from('messages')
      .insert({ conversation_id: convo!.id, sender_id: user.id, body: message });

    setSending(false);
    if (msgError) return setError(msgError.message);
    router.push(`/messages/${convo!.id}`);
  }

  return (
    <form onSubmit={handleSend} className="mt-4">
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        placeholder="Ask about tree fit, flocking, wear, shipping…"
        rows={3}
        className="w-full border rounded p-2 text-sm mb-2"
      />
      <button type="submit" disabled={sending} className="bg-saddle-brown text-white px-4 py-2 rounded-md font-semibold text-sm">
        {sending ? 'Sending…' : 'Ask a Question'}
      </button>
    </form>
  );
}
