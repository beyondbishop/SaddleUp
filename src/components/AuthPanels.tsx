'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { safeNext } from '@/lib/safe-next';
import { welcomeUrl } from '@/lib/onboarding';
import GoogleButton from '@/components/GoogleButton';

// One page for both: "Create an account" on the left, "Sign in" on the right, Google above both.
// Served at /auth/login and /auth/signup; `focus` says which one the visitor came for, which
// decides what shows first on a phone (where the two stack).

const input = 'w-full border border-saddle-line rounded p-2 bg-white';
const primary = 'w-full bg-saddle-green text-white rounded-md py-2 font-semibold disabled:opacity-60';

function SignupForm({ next }: { next: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // After confirming their email, bring them back to where they started.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      }
    });
    if (error) {
      setLoading(false);
      return setError(error.message);
    }
    if (data.session) {
      // Signed straight in (email confirmation off): welcome email now, then on to where they were going.
      await fetch('/api/account/welcome', { method: 'POST' }).catch(() => {});
      router.push(welcomeUrl(next));
      router.refresh();
      return;
    }
    // Otherwise the welcome goes out when they click the confirmation link (/auth/callback).
    setLoading(false);
    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <div role="status">
        <h2 className="text-xl font-bold text-saddle-brown mb-2">Check your email</h2>
        <p className="text-sm">We sent a confirmation link to {email} to finish creating your account.</p>
        {next.includes('from=home') && (
          <p className="text-sm text-saddle-muted mt-3">
            Open the link on this device and your saddle&apos;s photos and details will be waiting for you.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-labelledby="signup-heading">
      <h2 id="signup-heading" className="text-xl font-bold text-saddle-brown">New to SaddleUp?</h2>
      <p className="text-sm text-saddle-muted -mt-1">Create a free account to buy, sell and save saddles.</p>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <label htmlFor="signup-name" className="sr-only">Full name</label>
      <input id="signup-name" placeholder="Full name" required autoComplete="name" value={fullName}
        onChange={(e) => setFullName(e.target.value)} className={input} />
      <label htmlFor="signup-email" className="sr-only">Email</label>
      <input id="signup-email" type="email" required autoComplete="email" placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)} className={input} />
      <label htmlFor="signup-password" className="sr-only">Choose a password</label>
      <input id="signup-password" type="password" required minLength={6} autoComplete="new-password"
        placeholder="Choose a password (6+ characters)" value={password}
        onChange={(e) => setPassword(e.target.value)} className={input} />
      <button type="submit" disabled={loading} className={primary}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}

function LoginForm({ next }: { next: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return setError(error.message);
    }
    // Catch-all for anyone who never got their welcome email; does nothing once it's been sent.
    fetch('/api/account/welcome', { method: 'POST' }).catch(() => {});
    router.push(welcomeUrl(next)); // new members get the welcome steps; everyone else passes straight through
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-labelledby="login-heading">
      <h2 id="login-heading" className="text-xl font-bold text-saddle-brown">Already have an account?</h2>
      <p className="text-sm text-saddle-muted -mt-1">Welcome back. Sign in below.</p>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <label htmlFor="login-email" className="sr-only">Email</label>
      <input id="login-email" type="email" required autoComplete="email" placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)} className={input} />
      <label htmlFor="login-password" className="sr-only">Password</label>
      <input id="login-password" type="password" required autoComplete="current-password" placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)} className={input} />
      <button type="submit" disabled={loading} className={primary}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-sm">
        <Link href="/auth/forgot" className="underline">Forgot password?</Link>
      </p>
    </form>
  );
}

export default function AuthPanels({ focus }: { focus: 'login' | 'signup' }) {
  const searchParams = useSearchParams();
  // Only ever return to a page on this site.
  const next = safeNext(searchParams.get('next'));
  const err = searchParams.get('error');

  return (
    <div className="py-12 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-saddle-ink text-center mb-6">Welcome to SaddleUp</h1>

      {err === 'google' && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 mb-4 max-w-sm mx-auto">
          Google sign-in didn&apos;t finish. Please try again, or use your email below.
        </p>
      )}
      {err === 'link' && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 mb-4 max-w-sm mx-auto">
          That sign-in link has expired or was already used. Sign in below, or use “Forgot password?” to get a new one.
        </p>
      )}

      <div className="max-w-sm mx-auto">
        <GoogleButton next={next} />
        <p className="text-xs text-saddle-muted text-center mt-2">Works whether you’re new or already have an account.</p>
      </div>
      <div className="flex items-center gap-3 my-6 text-xs text-saddle-muted max-w-sm mx-auto">
        <span className="flex-1 border-t border-saddle-line" />or use your email<span className="flex-1 border-t border-saddle-line" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 md:gap-0">
        {/* On phones the one they came for comes first; side by side, create is always on the left. */}
        <section className={`md:pr-8 md:order-1 ${focus === 'login' ? 'order-2' : 'order-1'}`}>
          <SignupForm next={next} />
        </section>
        <section className={`md:pl-8 md:border-l border-saddle-line md:order-2 ${focus === 'login' ? 'order-1 border-b pb-6 md:border-b-0 md:pb-0' : 'order-2 border-t pt-6 md:border-t-0 md:pt-0'}`}>
          <LoginForm next={next} />
        </section>
      </div>
    </div>
  );
}
