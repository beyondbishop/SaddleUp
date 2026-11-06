'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { TREE_WIDTH_LABELS, type TreeWidth } from '@/lib/types';
import GoogleButton from '@/components/GoogleButton';

interface Claimable {
  id: string;
  seat_size: number;
  model: string;
  brand_name: string | null;
  tree_width: TreeWidth;
  price_cents: number;
}

type Status = 'loading' | 'found' | 'not_found' | 'check_email' | 'claiming';

export default function ClaimPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const router = useRouter();
  const [listing, setListing] = useState<Claimable | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: auth }, photos] = await Promise.all([
        supabase.rpc('get_claimable_listing', { p_token: params.token }),
        supabase.auth.getUser(),
        fetch(`/api/claim/${params.token}`)
          .then((r) => (r.ok ? r.json() : { images: [] }))
          .catch(() => ({ images: [] }))
      ]);
      setImages(Array.isArray(photos?.images) ? photos.images : []);
      const row = (data as Claimable[] | null)?.[0];
      if (!row) return setStatus('not_found');
      setListing(row);
      setSignedInEmail(auth.user?.email ?? null);
      setStatus('found');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  async function claim() {
    setStatus('claiming');
    const { data: id, error: claimError } = await supabase.rpc('claim_listing', { p_token: params.token });
    if (claimError || !id) {
      setStatus('found');
      setSaving(false);
      return setError('This listing could not be claimed — the link may already have been used.');
    }
    router.push(`/dashboard/listings/${id}/edit?claimed=1`);
  }

  async function handleSignUpAndClaim(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.href }
    });

    if (signUpError && /already registered/i.test(signUpError.message)) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setSaving(false);
        return setError('An account with this email already exists — enter its password to continue, or reset it.');
      }
      return claim();
    }
    if (signUpError) {
      setSaving(false);
      return setError(signUpError.message);
    }
    if (!signUp.session) {
      // Email confirmation is on: they confirm, land back on this page signed in, and click Claim.
      setSaving(false);
      return setStatus('check_email');
    }
    return claim();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSignedInEmail(null);
  }

  const saddleName = listing
    ? `${listing.seat_size}" ${listing.brand_name && listing.brand_name !== 'Other' ? `${listing.brand_name} ` : ''}${listing.model}`
    : '';

  if (status === 'loading') return <p className="py-16 text-center">Loading…</p>;

  if (status === 'not_found') {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <h1 className="font-serif text-2xl mb-2">This claim link isn&apos;t valid</h1>
        <p className="text-saddle-muted">It may have already been claimed, or the link is incorrect.</p>
      </div>
    );
  }

  if (status === 'check_email') {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <h1 className="font-serif text-2xl mb-2">Check your email</h1>
        <p className="text-saddle-muted">
          We sent a confirmation link to <strong>{email}</strong>. Click it and you&apos;ll come straight back here to
          finish claiming your {saddleName}.
        </p>
      </div>
    );
  }

  return (
    <div className="py-12 max-w-md mx-auto">
      <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-saddle-gold mb-2">Free listing</div>
      <h1 className="font-serif text-3xl text-saddle-ink mb-3">Claim your saddle</h1>
      <div className="bg-saddle-paper border border-saddle-line rounded p-4 mb-5">
        {images.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {images.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={i === 0 ? saddleName : ''}
                className={`${i === 0 ? 'h-40 w-56' : 'h-40 w-28'} shrink-0 object-cover rounded border border-saddle-line`}
              />
            ))}
          </div>
        )}
        <div className="font-serif text-xl text-saddle-ink">{saddleName}</div>
        <div className="text-sm text-saddle-muted">
          {TREE_WIDTH_LABELS[listing!.tree_width]} Tree · $
          {(listing!.price_cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </div>
      </div>
      <p className="text-saddle-body mb-6">
        We set up a free listing for your saddle on SaddleUp, where riders search by tree width and seat size.{' '}
        {images.length
          ? 'It already has your photos and details. Claim it, check everything and add any photos you like'
          : 'Claim it, add your photos and check the details'}
        {' '}— it goes live after a quick review. No cost, no obligation to sell here.
      </p>

      {error && <p className="text-red-700 text-sm mb-3">{error}</p>}

      {signedInEmail ? (
        <div className="space-y-3">
          <button
            onClick={() => {
              setSaving(true);
              claim();
            }}
            disabled={saving || status === 'claiming'}
            className="w-full bg-saddle-green text-saddle-cream rounded-sm py-3 font-semibold"
          >
            {status === 'claiming' ? 'Claiming…' : `Claim to ${signedInEmail}`}
          </button>
          <p className="text-sm text-saddle-muted text-center">
            Not you?{' '}
            <button onClick={signOut} className="underline">
              Sign out
            </button>
          </p>
        </div>
      ) : (
        <div>
          <GoogleButton next={`/claim/${params.token}`} label="Claim with Google" />
          <p className="text-xs text-saddle-muted text-center mt-2">You&apos;ll come back here to finish claiming.</p>
        <div className="flex items-center gap-3 my-4 text-xs text-saddle-muted">
        <span className="flex-1 border-t border-saddle-line" />or<span className="flex-1 border-t border-saddle-line" />
      </div>
        <form onSubmit={handleSignUpAndClaim} className="space-y-3">
          <input placeholder="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-saddle-line rounded p-2 bg-saddle-paper" />
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-saddle-line rounded p-2 bg-saddle-paper" />
          <input type="password" placeholder="Create a password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-saddle-line rounded p-2 bg-saddle-paper" />
          <button type="submit" disabled={saving} className="w-full bg-saddle-green text-saddle-cream rounded-sm py-3 font-semibold">
            {saving ? 'Claiming…' : 'Claim my free listing'}
          </button>
          <p className="text-xs text-saddle-muted text-center">Already have a SaddleUp account? Use the same email and password.</p>
        </form>
        </div>
      )}
    </div>
  );
}
