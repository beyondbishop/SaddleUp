'use client';

import { useEffect, useRef, useState } from 'react';
import OpenPostLink from './OpenPostLink';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Everything an importer needs to contact a seller, in one place: "Copy message" at the top, the
 * message (shown, editable, saved as they type), a link to their post, and a preview of what the
 * seller will see. Copying marks the seller as messaged (for My imports' "Waiting" and "Follow up"),
 * with an undo, so there's no separate step to remember.
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
  const [copied, setCopied] = useState(false);
  const [messaged, setMessaged] = useState<string | null>(messagedAt);
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

  async function markMessaged(value: boolean) {
    const res = await fetch(`/api/imports/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaged: value })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) setMessaged(data.messaged_at ?? null);
  }

  // Copying the message means it's about to be sent, so record that too (once).
  async function copyMessage() {
    await copy();
    setCopied(true);
    setTimeout(() => setCopied(false), 8000);
    if (showMarkMessaged && !messaged) markMessaged(true);
  }

  const first = (sellerName ?? '').trim().split(/\s+/)[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`msg-${listingId}`} className="text-xs font-mono uppercase tracking-[0.14em] text-saddle-gold">
          Message to {first || 'the seller'}
        </label>
        <button
          type="button"
          onClick={copyMessage}
          className="bg-saddle-green text-saddle-cream px-4 py-2 rounded-sm font-semibold text-sm shrink-0"
        >
          {copied ? '✓ Copied' : 'Copy message'}
        </button>
      </div>
      {copied && (
        <p className="text-sm text-saddle-green">
          ✓ Copied{showMarkMessaged ? ' and marked as messaged' : ''}. Paste it into your Messenger chat with them.
        </p>
      )}
      <div className="flex justify-end -mb-1">
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
        {sourceUrl && <OpenPostLink url={sourceUrl} label="Open their post" />}
        <a href={claimUrl} target="_blank" rel="noopener noreferrer" className="underline text-saddle-brown">
          See what they&apos;ll see ↗
        </a>
        {showMarkMessaged && messaged && (
          <span className="text-saddle-green">
            Messaged {new Date(messaged).toLocaleDateString('en-US')}{' '}
            <button type="button" onClick={() => markMessaged(false)} className="underline text-gray-500 text-xs">
              undo
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
