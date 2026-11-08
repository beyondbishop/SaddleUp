'use client';

import { useEffect, useRef, useState } from 'react';

export interface HelperChange {
  field: string;
  value: string;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /** Not shown as a bubble (the automatic "what should I check?" opener). */
  hidden?: boolean;
  /** Fields this reply changed, and how to put them back. */
  changed?: string[];
  undo?: () => void;
  undone?: boolean;
}

const OPENER = "I've just opened the helper. What should I check or fix first?";

/**
 * The listing helper: a small chat under the reader's notes that can fill in and fix the form.
 * `getContext` reads the form as it is right now; `apply` writes the helper's changes into it and
 * returns what changed plus an undo. Nothing is saved until the person clicks Save.
 */
export default function ListingHelper({
  getContext,
  apply,
  autoStart
}: {
  getContext: () => Record<string, unknown>;
  apply: (changes: HelperChange[]) => { changed: string[]; undo: () => void };
  autoStart: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [quick, setQuick] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(autoStart);
  const started = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    // Give the prefilled form a moment to settle before reading it.
    const t = setTimeout(() => send(OPENER, true), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns, busy]);

  async function send(text: string, hidden = false) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content, hidden }];
    setTurns(next);
    setDraft('');
    setQuick([]);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/listing-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: next.map(({ role, content }) => ({ role, content })), context: getContext() }),
        signal: AbortSignal.timeout(60_000)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'The helper couldn’t answer just now.');
      const result = (json.changes?.length ? apply(json.changes) : { changed: [], undo: () => {} }) as ReturnType<typeof apply>;
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: json.reply, changed: result.changed, undo: result.changed.length ? result.undo : undefined }
      ]);
      setQuick(json.quick_replies ?? []);
    } catch (e) {
      setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'That took too long. Try again.');
      // Let them try the same message again.
      setTurns((prev) => prev.slice(0, -1));
      if (!hidden) setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  function undo(i: number) {
    turns[i].undo?.();
    setTurns((prev) => prev.map((t, j) => (j === i ? { ...t, undone: true } : t)));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded border border-saddle-line bg-saddle-paper px-4 py-3 hover:border-saddle-brown"
      >
        <span className="block font-semibold text-saddle-ink">✨ Listing helper</span>
        <span className="block text-sm text-saddle-muted">Tell it what to change ("price is $2,400, comes with a girth") and it fills in the form for you.</span>
      </button>
    );
  }

  const shown = turns.map((t, i) => ({ t, i })).filter(({ t }) => !t.hidden);

  return (
    <section aria-label="Listing helper" className="rounded border border-saddle-green bg-saddle-paper">
      <header className="px-4 py-2 border-b border-saddle-line flex items-center justify-between gap-2">
        <p className="font-semibold text-saddle-ink">✨ Listing helper</p>
        <p className="text-xs text-saddle-muted">Changes go into the form below. Nothing saves until you click Save.</p>
      </header>

      <div className="px-4 py-3 space-y-3 max-h-80 overflow-y-auto" aria-live="polite">
        {!shown.length && !busy && (
          <p className="text-sm text-saddle-muted">Ask for any change, like "set the tree to medium-wide" or "add that it comes with a girth".</p>
        )}
        {shown.map(({ t, i }) => (
          <div key={i} className={t.role === 'user' ? 'flex justify-end' : ''}>
            <div
              className={`max-w-[90%] rounded px-3 py-2 text-sm ${
                t.role === 'user' ? 'bg-saddle-brown text-saddle-cream' : 'bg-white border border-saddle-line text-saddle-ink'
              }`}
            >
              <p className="whitespace-pre-line">{t.content}</p>
              {t.changed && t.changed.length > 0 && (
                <p className="mt-1 text-xs text-saddle-muted">
                  {t.undone ? 'Undone: ' : 'Changed: '}
                  {t.changed.join(', ')}
                  {!t.undone && t.undo && (
                    <>
                      {' · '}
                      <button type="button" onClick={() => undo(i)} className="underline hover:text-saddle-brown">
                        Undo
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-saddle-muted">Thinking…</p>}
        <div ref={end} />
      </div>

      {quick.length > 0 && !busy && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-full border border-saddle-brown px-3 py-1 text-sm text-saddle-brown hover:bg-saddle-brown hover:text-saddle-cream"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {error && <p className="px-4 pb-2 text-sm text-red-700">{error}</p>}

      <div className="px-4 pb-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Enter sends a message; it must never submit (save) the listing form around it.
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send(draft);
            }
          }}
          placeholder="Tell the helper what to change…"
          aria-label="Message the listing helper"
          className="flex-1 border border-saddle-line rounded p-2 bg-white text-sm"
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => send(draft)}
          disabled={busy || !draft.trim()}
          className="rounded bg-saddle-green px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  );
}
