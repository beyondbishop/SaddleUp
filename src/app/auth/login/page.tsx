'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GoogleButton from '@/components/GoogleButton';
import { safeNext } from '@/lib/safe-next';

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only ever return to a page on this site.
  const next = safeNext(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    // Catch-all for anyone who never got their welcome email; does nothing once it's been sent.
    fetch('/api/account/welcome', { method: 'POST' }).catch(() => {});
    router.push(next);
    router.refresh();
  }

  return (
    <div className="py-16 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Sign In</h1>
      {searchParams.get('error') === 'google' && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 mb-4">
          Google sign-in didn&apos;t finish. Please try again, or use your email and password.
        </p>
      )}
      <GoogleButton next={next} />
      <div className="flex items-center gap-3 my-4 text-xs text-saddle-muted">
        <span className="flex-1 border-t border-saddle-line" />or<span className="flex-1 border-t border-saddle-line" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-2"
        />
        <input
          type="password" required placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} className="w-full border rounded p-2"
        />
        <button type="submit" disabled={loading} className="w-full bg-saddle-green text-white rounded-md py-2 font-semibold">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p className="text-sm mt-4">
        No account? <Link href={`/auth/signup?next=${encodeURIComponent(next)}`} className="underline">Create one</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
