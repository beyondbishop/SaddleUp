'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Admin-only account actions for one user: email a sign-in link, freeze/unfreeze, delete.
 *  The server re-checks that the caller is an admin. */
export default function UserAccountActions({ userId, email, frozen: initialFrozen, isSelf }: {
  userId: string; email: string | null; frozen: boolean; isSelf: boolean;
}) {
  const router = useRouter();
  const [frozen, setFrozen] = useState(initialFrozen);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(method: 'POST' | 'DELETE', body?: object) {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setNote({ ok: false, text: data?.error ?? 'Something went wrong.' });
      return null;
    }
    return data;
  }

  async function sendLogin() {
    if (!window.confirm(`Email ${email} a link that signs them in and lets them set a new password?`)) return;
    const data = await call('POST', { action: 'send_login' });
    if (data) setNote({ ok: true, text: `Sign-in link sent to ${data.email}.` });
  }

  async function toggleFreeze() {
    const freeze = !frozen;
    const msg = freeze
      ? `Freeze ${email}? They'll be signed out and can't sign in, and their live saddles go back to drafts. You can unfreeze them later.`
      : `Unfreeze ${email}? They can sign in again. Their saddles stay as drafts until they relist them.`;
    if (!window.confirm(msg)) return;
    const data = await call('POST', { action: freeze ? 'freeze' : 'unfreeze' });
    if (!data) return;
    setFrozen(data.frozen);
    setNote({ ok: true, text: freeze ? `Frozen.${data.hidden ? ` ${data.hidden} saddle${data.hidden === 1 ? '' : 's'} hidden.` : ''}` : 'Unfrozen.' });
    router.refresh();
  }

  async function remove() {
    const typed = window.prompt(
      `Permanently delete ${email}? This removes their account, profile, saved lists and messages, and takes their saddles off the site. It can't be undone.\n\nType DELETE to confirm.`
    );
    if (typed?.trim().toUpperCase() !== 'DELETE') return;
    const data = await call('DELETE');
    if (data) router.refresh();
  }

  const btn = 'underline decoration-saddle-line hover:decoration-saddle-ink disabled:opacity-50 text-left';
  return (
    <div className="space-y-1 mt-2 pt-2 border-t border-saddle-line text-xs">
      <div className="flex flex-col items-start gap-1">
        <button type="button" onClick={sendLogin} disabled={busy || frozen || !email} className={btn}>Email sign-in link</button>
        {!isSelf && (
          <>
            <button type="button" onClick={toggleFreeze} disabled={busy} className={btn}>{frozen ? 'Unfreeze' : 'Freeze'}</button>
            <button type="button" onClick={remove} disabled={busy} className={`${btn} text-red-700`}>Delete</button>
          </>
        )}
      </div>
      {note && <p role={note.ok ? 'status' : 'alert'} className={note.ok ? 'text-saddle-green' : 'text-red-700'}>{note.text}</p>}
    </div>
  );
}
