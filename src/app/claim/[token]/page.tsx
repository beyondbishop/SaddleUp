'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Listing } from '@/lib/types';

export default function ClaimPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'claimed'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('listings')
      .select('*, brands(name)')
      .eq('claim_token', params.token)
      .eq('source', 'seeded')
      .single()
      .then(({ data }) => {
        if (!data) return setStatus('not_found');
        setListing(data as any);
        setStatus('found');
      });
  }, [params.token]);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Create the account (or sign in if it already exists), then attach
    // this listing to the new seller and flip it to an active listing.
    let userId: string | undefined;
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });

    if (signUpError && signUpError.message.includes('already registered')) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setSaving(false);
        return setError('An account with this email exists — enter its password to continue, or reset it.');
      }
      userId = signInData.user?.id;
    } else if (signUpError) {
      setSaving(false);
      return setError(signUpError.message);
    } else {
      userId = signUpData.user?.id;
    }

    if (!userId || !listing) {
      setSaving(false);
      return setError('Something went wrong — please try again.');
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update({ seller_id: userId, status: 'active', claimed_at: new Date().toISOString(), source: 'seller' })
      .eq('id', listing.id);

    setSaving(false);
    if (updateError) return setError(updateError.message);
    setStatus('claimed');
    setTimeout(() => router.push('/dashboard'), 1500);
  }

  if (status === 'loading') return <p className="py-16 text-center">Loading…</p>;
  if (status === 'not_found') {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-2">This claim link isn&apos;t valid</h1>
        <p className="text-gray-600">It may have already been claimed, or the link is incorrect.</p>
      </div>
    );
  }
  if (status === 'claimed') {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-2">Your listing is live!</h1>
        <p>Redirecting you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="py-12 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">Claim your free listing</h1>
      <p className="text-gray-600 mb-6">
        We found your <strong>{listing?.seat_size}&quot; {(listing as any)?.brands?.name} {listing?.model}</strong> and
        set up a free listing for it on SaddleUp. Create a password to claim it, manage it, and start
        receiving inquiries — no cost, no obligation to sell here.
      </p>
      <form onSubmit={handleClaim} className="space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input placeholder="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded p-2" />
        <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-2" />
        <input type="password" placeholder="Create a password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded p-2" />
        <button type="submit" disabled={saving} className="w-full bg-saddle-green text-white rounded-md py-2 font-semibold">
          {saving ? 'Claiming…' : 'Claim My Free Listing'}
        </button>
      </form>
    </div>
  );
}
