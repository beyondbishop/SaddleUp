'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SignupPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    setLoading(false);
    if (error) return setError(error.message);
    setDone(true);
  }

  if (done) {
    return (
      <div className="py-16 max-w-sm mx-auto text-center">
        <h1 className="text-2xl font-bold text-saddle-brown mb-2">Check your email</h1>
        <p>We sent you a confirmation link to finish creating your account.</p>
      </div>
    );
  }

  return (
    <div className="py-16 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Create Account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input
          placeholder="Full name" required value={fullName}
          onChange={(e) => setFullName(e.target.value)} className="w-full border rounded p-2"
        />
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-2"
        />
        <input
          type="password" required minLength={6} placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} className="w-full border rounded p-2"
        />
        <button type="submit" disabled={loading} className="w-full bg-saddle-green text-white rounded-md py-2 font-semibold">
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
      <p className="text-sm mt-4">
        Already have an account? <Link href="/auth/login" className="underline">Sign in</Link>
      </p>
    </div>
  );
}
