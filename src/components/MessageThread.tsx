'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Msg {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export default function MessageThread({
  conversationId,
  initialMessages,
  currentUserId
}: {
  conversationId: string;
  initialMessages: Msg[];
  currentUserId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: currentUserId, body })
      .select()
      .single();
    setSending(false);
    if (!error && data) {
      setMessages((prev) => [...prev, data]);
      setBody('');
      router.refresh();
    }
  }

  return (
    <div>
      <div className="bg-white border border-saddle-tan rounded-lg p-4 space-y-3 mb-4 max-h-96 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className={m.sender_id === currentUserId ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block px-3 py-2 rounded-lg text-sm ${
                m.sender_id === currentUserId ? 'bg-saddle-green text-white' : 'bg-saddle-cream'
              }`}
            >
              {m.body}
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 border rounded p-2 text-sm"
        />
        <button type="submit" disabled={sending} className="bg-saddle-green text-white px-4 py-2 rounded-md font-semibold text-sm">
          Send
        </button>
      </form>
    </div>
  );
}
