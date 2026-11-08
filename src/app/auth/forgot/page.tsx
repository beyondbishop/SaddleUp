'use client';

import { useState } from 'react';
import Link from 'next/link';

// "Forgot password?": we email a one-time link that signs them in, then lets them set a new password.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch('/api/account/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSending(false);
    if (!res?.ok) return setError(data?.error ?? 'Something went wrong. Please try again.');
    setSent(true);
  }

  return (
    <div className="py-16 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">Forgot your password?</h1>
      {sent ? (
        <>
          <p className="text-sm mb-4" role="status">
            If there’s a SaddleUp account for {email}, we’ve emailed it a sign-in link. It works once and expires in 1 hour.
            Check your spam folder if it doesn’t arrive in a few minutes.
          </p>
          <Link href="/auth/login" className="underline text-sm">Back to sign in</Link>
        </>
      ) : (
        <>
          <p className="text-sm text-saddle-muted mb-6">Enter your email and we’ll send you a link that signs you in. You can set a new password from there.</p>
          <form onSubmit={submit} className="space-y-4">
            {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
            <label htmlFor="forgot-email" className="sr-only">Email</label>
            <input id="forgot-email" type="email" required autoComplete="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-2" />
            <button type="submit" disabled={sending} className="w-full bg-saddle-green text-white rounded-md py-2 font-semibold">
              {sending ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
          <p className="text-sm mt-4">
            Signed up with Google? Just use <Link href="/auth/login" className="underline">Continue with Google</Link>. There’s no password to reset.
          </p>
        </>
      )}
    </div>
  );
}
