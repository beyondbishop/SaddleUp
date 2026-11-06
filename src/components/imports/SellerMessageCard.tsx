'use client';

import { useEffect, useRef, useState } from 'react';
import MarkMessagedButton from './MarkMessagedButton';
import OpenPostLink, { openPostWindow, postHref } from './OpenPostLink';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Everything an importer needs to contact a seller, in one place: the message (shown, editable,
 * saved as they type), "Copy message & open their post", the post itself, a preview of what the
 * seller will see, and "I've messaged them".
 *
 * `suggested` is the message SaddleUp wrote. `saved` is the importer's saved version, if any.
 * While they haven't edited it, a newer suggestion (e.g. once the price check finishes) replaces
 * it and is saved.
 */
export default function SellerMessageCard({
  listingId,
  sellerName,
  suggested,
  saved,
  sourceUrl,
  claimUrl,
  messagedAt,
  showMarkMessaged = true
}: {
  listingId: string;
  sellerName?: string | null;
  suggested: string;
  saved?: string | null;
  sourceUrl?: string | null;
  claimUrl: string;
  messagedAt: string | null;
  showMarkMessaged?: boolean;
}) {
  const [text, setText] = useState(saved ?? suggested);
  const [edited, setEdited] = useState(!!saved && saved !== suggested);
  const [save, setSave] = useState<SaveState>('idle');
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const lastSaved = useRef(saved ?? null);

  async function persist(message: string) {
    if (message === lastSaved.current) return;
    setSave('saving');
    const res = await fetch(`/api/imports/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    }).catch(() => null);
    if (res?.ok) lastSaved.current = message;
    setSave(res?.ok ? 'saved' : 'error');
  }

  // A newer suggestion replaces the text until the importer edits it themselves.
  useEffect(() => {
    if (edited) return;
    setText(suggested);
    if (!saved || saved !== suggested) persist(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);

  function onChange(v: string) {
    setText(v);
    setEdited(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(v), 800);
  }

  async function copy(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      window.prompt('Copy this message:', text);
      return false;
    }
  }

  async function copyAndOpen() {
    // Open first: browsers only allow pop-ups straight from the click.
    const opened = sourceUrl ? openPostWindow(postHref(sourceUrl)) : false;
    await copy();
    setCopied(sourceUrl ? (opened ? 'open' : 'blocked') : 'copied');
    setTimeout(() => setCopied(null), 8000);
  }

  const first = (sellerName ?? '').trim().split(/\s+/)[0];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`msg-${listingId}`} className="text-xs font-mono uppercase tracking-[0.14em] text-saddle-gold">
          Message to {first || 'the seller'}
        </label>
        <span className="text-xs text-saddle-muted min-h-[1rem]">
          {save === 'saving' && 'Saving…'}
          {save === 'saved' && edited && 'Saved ✓'}
          {save === 'error' && <span className="text-red-700">Couldn&apos;t save your edits. They&apos;ll still copy.</span>}
        </span>
      </div>
      <textarea
        id={`msg-${listingId}`}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          clearTimeout(timer.current);
          persist(text);
        }}
        rows={Math.min(16, Math.max(6, text.split('\n').length + 2))}
        className="w-full text-sm border border-saddle-line rounded p-3 bg-saddle-paper leading-relaxed"
      />
      {edited && text !== suggested && (
        <button
          type="button"
          onClick={() => {
            setText(suggested);
            setEdited(false);
            persist(suggested);
          }}
          className="text-xs underline text-saddle-muted"
        >
          Reset to our suggested message
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={copyAndOpen}
          className="bg-saddle-green text-saddle-cream px-4 py-2 rounded-sm font-semibold text-sm"
        >
          {sourceUrl ? 'Copy message & open their post ↗' : 'Copy message'}
        </button>
        {sourceUrl && <OpenPostLink url={sourceUrl} label="Open their post" />}
        <a href={claimUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline text-saddle-brown">
          See what they&apos;ll see ↗
        </a>
        {showMarkMessaged && <MarkMessagedButton listingId={listingId} messagedAt={messagedAt} />}
      </div>
      {copied === 'open' && (
        <p className="text-sm text-saddle-green">
          ✓ Copied. In the window that opened, click <strong>Message</strong> on their post, paste, and send. Then tick
          &quot;I&apos;ve messaged them&quot;.
        </p>
      )}
      {copied === 'blocked' && (
        <p className="text-sm text-saddle-brown">
          ✓ Copied, but your browser blocked the new window. Click &quot;Open their post&quot;, then Message, and paste.
        </p>
      )}
      {copied === 'copied' && (
        <p className="text-sm text-saddle-green">✓ Copied. Paste it into your Messenger chat with them.</p>
      )}
      {!sourceUrl && (
        <p className="text-xs text-saddle-muted">No link to their post was saved, so find them on Facebook and paste the message there.</p>
      )}
    </div>
  );
}
