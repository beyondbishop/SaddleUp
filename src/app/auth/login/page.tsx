'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
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
    router.push(searchParams.get('next') ?? '/dashboard');
    router.refresh();
  }

  return (
    <div className="py-16 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Sign In</h1>
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
        No account? <Link href="/auth/signup" className="underline">Create one</Link>
      </p>
    </div>
  );
}
