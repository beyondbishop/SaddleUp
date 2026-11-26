'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { alertRecipient } from '@/components/InquiryBox';
import Avatar from '@/components/Avatar';
import type { InboxMessage, InboxSaddle } from '@/lib/inbox';

interface Person {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

const TZ = 'America/New_York';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday';
  return d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' });
}
const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function SaddleCard({ s }: { s: InboxSaddle }) {
  const body = (
    <>
      {s.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.image} alt="" className="w-12 h-12 rounded object-cover bg-saddle-sand shrink-0" />
      ) : (
        <span className="w-12 h-12 rounded bg-saddle-sand shrink-0" />
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-saddle-ink truncate">{s.label}</span>
        <span className="block text-xs text-saddle-muted">
          {s.priceCents ? usd(s.priceCents) : null}
          {s.status === 'sold' ? ' · Sold' : s.status === 'pending_sale' ? ' · Sale pending' : ''}
          {s.slug ? <span className="underline ml-1 text-saddle-brown">View saddle</span> : null}
        </span>
      </span>
    </>
  );
  return s.slug ? (
    <Link href={`/saddles/${s.slug}`} className="flex items-center gap-3 p-2 rounded-lg border border-saddle-line bg-saddle-paper hover:border-saddle-brown max-w-sm">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-saddle-line bg-saddle-paper max-w-sm">{body}</div>
  );
}

export default function MessageThread({
  other,
  me,
  otherIsSeller,
  otherIsSaddleUp,
  saddles,
  initialMessages,
  defaultConversationId
}: {
  other: Person;
  me: Person;
  otherIsSeller: boolean;
  otherIsSaddleUp: boolean;
  saddles: InboxSaddle[];
  initialMessages: InboxMessage[];
  defaultConversationId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState(defaultConversationId);
  const scroller = useRef<HTMLDivElement>(null);

  // New props after router.refresh() (e.g. a different person was opened): start from them.
  useEffect(() => setMessages(initialMessages), [initialMessages]);
  useEffect(() => setReplyTo(defaultConversationId), [defaultConversationId]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, other.id]);

  const saddleById = useMemo(() => new Map(saddles.map((s) => [s.conversationId, s])), [saddles]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: replyTo, sender_id: me.id, body: text })
      .select('id, conversation_id, sender_id, body, created_at, read_at')
      .single();
    setSending(false);
    if (error || !data) return setError('Your message didn’t send. Please try again.');
    alertRecipient(data.id);
    setMessages((prev) => [...prev, data as InboxMessage]);
    setBody('');
    router.refresh();
  }

  // Build the timeline: a date line when the day changes, the saddle when the topic changes,
  // and a name + time header when the speaker changes (or 10+ minutes pass).
  const items: React.ReactNode[] = [];
  let prev: InboxMessage | null = null;
  for (const m of messages) {
    if (!prev || dayKey(prev.created_at) !== dayKey(m.created_at)) {
      items.push(
        <div key={`d-${m.id}`} className="flex items-center gap-3 my-4 text-xs text-saddle-muted" role="separator">
          <span className="h-px flex-1 bg-saddle-line" />
          {dayLabel(m.created_at)}
          <span className="h-px flex-1 bg-saddle-line" />
        </div>
      );
    }
    const topicChanged = !prev || prev.conversation_id !== m.conversation_id;
    const saddle = saddleById.get(m.conversation_id);
    if (topicChanged && saddle) {
      items.push(
        <div key={`s-${m.id}`} className="my-3">
          <p className="text-xs text-saddle-muted mb-1">About</p>
          <SaddleCard s={saddle} />
        </div>
      );
    }
    const mine = m.sender_id === me.id;
    const who = mine ? me : other;
    const newRun =
      topicChanged ||
      !prev ||
      prev.sender_id !== m.sender_id ||
      new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 10 * 60_000 ||
      dayKey(prev.created_at) !== dayKey(m.created_at);
    items.push(
      <div key={m.id} className={`flex gap-3 ${newRun ? 'mt-4' : 'mt-1'}`}>
        <span className="w-10 shrink-0">{newRun && <Avatar url={who.avatarUrl} initials={who.initials} size={40} />}</span>
        <div className="min-w-0 flex-1">
          {newRun && (
            <p className="text-sm">
              <span className="font-semibold text-saddle-ink">{mine ? 'You' : who.name}</span>
              <span className="text-saddle-muted"> · {time(m.created_at)}</span>
            </p>
          )}
          <p className="text-[0.95rem] text-saddle-ink whitespace-pre-wrap break-words">{m.body}</p>
        </div>
      </div>
    );
    prev = m;
  }

  const replySaddle = saddleById.get(replyTo);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-saddle-line">
        <Link href="/messages" className="md:hidden text-saddle-brown text-xl px-1" aria-label="Back to all messages">
          ‹
        </Link>
        <Avatar url={other.avatarUrl} initials={other.initials} size={44} />
        <div className="min-w-0">
          <p className="font-semibold text-saddle-ink truncate">
            {other.name}
            {otherIsSaddleUp && <span className="ml-1 text-xs font-normal text-saddle-muted">· SaddleUp</span>}
          </p>
          <p className="text-xs text-saddle-muted truncate">
            {otherIsSeller ? (
              <Link href={`/sellers/${other.id}`} className="underline text-saddle-brown">View profile & reviews</Link>
            ) : (
              'Shopper'
            )}
            {saddles.length > 1 && <> · {saddles.length} saddles</>}
          </p>
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 pb-4 max-h-[60vh] md:max-h-none">
        {items.length ? items : <p className="py-8 text-sm text-saddle-muted">No messages yet. Say hello below.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-saddle-line p-3 space-y-2 bg-saddle-paper"
      >
        {saddles.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-saddle-muted">
            About
            <select
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              className="border border-saddle-line rounded px-2 py-1 text-xs text-saddle-ink bg-white max-w-[16rem]"
            >
              {saddles.map((s) => (
                <option key={s.conversationId} value={s.conversationId}>{s.label}</option>
              ))}
            </select>
          </label>
        ) : replySaddle ? (
          <p className="text-xs text-saddle-muted">About {replySaddle.label}</p>
        ) : null}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          placeholder={`Write to ${other.name}…`}
          aria-label={`Message ${other.name}`}
          className="w-full border border-saddle-line rounded-lg p-3 text-sm resize-none bg-white"
        />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-saddle-faint hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="ml-auto bg-saddle-green text-white px-5 py-2 rounded-md font-semibold text-sm disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
