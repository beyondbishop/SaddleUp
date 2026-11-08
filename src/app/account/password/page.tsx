'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { authErrorText } from '@/lib/auth-error';

// Where emailed sign-in links land. The person is already signed in; here they can set a new
// password. Google users can skip it.
export default function SetPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Please use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setSaving(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(authErrorText(error));
    setDone(true);
  }

  if (!checked) return <div className="py-16 text-center">Loading…</div>;

  if (!email) {
    return (
      <div className="py-16 max-w-sm mx-auto">
        <h1 className="text-2xl font-bold text-saddle-brown mb-4">Set a password</h1>
        <p className="text-sm mb-4">Your sign-in link has expired or was already used. Request a new one below, or sign in as usual.</p>
        <Link href="/auth/forgot" className="underline mr-4">Get a new link</Link>
        <Link href="/auth/login" className="underline">Go to sign in</Link>
      </div>
    );
  }

  return (
    <div className="py-16 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">You’re signed in</h1>
      <p className="text-sm text-saddle-muted mb-6">as {email}</p>
      {done ? (
        <>
          <p className="text-sm mb-4">Your new password is saved. Use it with {email} next time you sign in.</p>
          <Link href="/dashboard" className="inline-block bg-saddle-green text-white rounded-md px-4 py-2 font-semibold">Go to my dashboard</Link>
        </>
      ) : (
        <>
          <form onSubmit={save} className="space-y-4">
            <h2 className="font-semibold">Set a new password</h2>
            {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
            <label htmlFor="new-password" className="sr-only">New password</label>
            <input id="new-password" type="password" required autoComplete="new-password" placeholder="New password (8+ characters)"
              value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded p-2" />
            <label htmlFor="confirm-password" className="sr-only">Confirm new password</label>
            <input id="confirm-password" type="password" required autoComplete="new-password" placeholder="Type it again"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full border rounded p-2" />
            <button type="submit" disabled={saving} className="w-full bg-saddle-green text-white rounded-md py-2 font-semibold">
              {saving ? 'Saving…' : 'Save password'}
            </button>
          </form>
          <p className="text-sm mt-4">
            Sign in with Google? You don’t need a password. <Link href="/dashboard" className="underline">Skip to my dashboard</Link>
          </p>
        </>
      )}
    </div>
  );
}
