'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { treeWidthText, type TreeWidth } from '@/lib/types';
import GoogleButton from '@/components/GoogleButton';
import { SELLER_FEE_CAP_DOLLARS, SELLER_FEE_PERCENT } from '@/lib/fees';
import { authErrorText } from '@/lib/auth-error';
import { TEAM_COOKIE } from '@/lib/claim-opens-shared';

const PERKS = [
  ['Found by the right riders', 'Buyers search by seat size and tree width, so the people who see your saddle are the ones it fits.'],
  [
    `Just ${SELLER_FEE_PERCENT}% when it sells`,
    `We're in beta, so it's free to list and ${SELLER_FEE_PERCENT}% only if it sells (never more than $${SELLER_FEE_CAP_DOLLARS}). That includes the ~3% card processing fee, so nothing else comes out. No sale, no fee.`
  ],
  ['Payment and shipping handled', 'Buyers pay through SaddleUp and we give you the shipping label. No meetups with strangers or chasing payments.'],
  ['Buyers buy with confidence', 'Every buyer gets a 5-day inspection window, which makes them more willing to buy a saddle they haven’t sat in.']
] as const;

interface Claimable {
  id: string;
  seat_size: number;
  model: string;
  brand_name: string | null;
  tree_width: TreeWidth | null;
  price_cents: number;
}

type Status = 'loading' | 'found' | 'not_found' | 'check_email' | 'claiming' | 'removed';

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
  // The listing's page, when shoppers can already see it, so the seller can preview it.
  const [listingUrl, setListingUrl] = useState<string | null>(null);
  // An importer or admin opening the link: show them the seller's view, but no claim button.
  const [viewerIsImporter, setViewerIsImporter] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

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
      setListingUrl(photos?.isPublic && typeof photos.slug === 'string' ? `/saddles/${photos.slug}` : null);
      setViewerIsImporter(!!photos?.viewerIsImporter);
      // Remember this browser as an importer's, so later signed-out opens here aren't counted as the seller.
      if (photos?.viewerIsImporter) document.cookie = `${TEAM_COOKIE}=1; max-age=31536000; path=/; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
      const row = (data as Claimable[] | null)?.[0];
      // Already claimed into their account (e.g. from another browser): their dashboard has it.
      if (!row && auth.user) return router.replace('/dashboard');
      if (!row) return setStatus('not_found');
      setListing(row);
      setSignedInEmail(auth.user?.email ?? null);
      setStatus('found');
      // Back here signed in after starting the claim (confirmed email, Google): finish it without another tap.
      const u = auth.user;
      const back = new URLSearchParams(window.location.search).has('auto') || u?.user_metadata?.claim_token === params.token;
      if (u?.email_confirmed_at && back && !photos?.viewerIsImporter) claim();
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
      options: {
        // claim_token: if they confirm their email in another browser (common from Facebook's in-app
        // browser), the claim finishes on whatever page they reach first signed in (lib/pending-claim).
        data: { full_name: fullName, first_name: fullName.trim().split(/\s+/)[0] || null, claim_token: params.token },
        emailRedirectTo: `${window.location.origin}/claim/${params.token}?auto=1`
      }
    });

    // An existing account: Supabase says "already registered", or (with email confirmation on) returns a user with no identities.
    if ((signUpError && /already registered/i.test(signUpError.message)) || (!signUpError && signUp.user?.identities?.length === 0)) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setSaving(false);
        return setError('An account with this email already exists — enter its password to continue, or reset it.');
      }
      return claim();
    }
    if (signUpError) {
      setSaving(false);
      return setError(authErrorText(signUpError));
    }
    if (!signUp.session) {
      // Email confirmation is on: they confirm, land back on this page signed in, and click Claim.
      setSaving(false);
      return setStatus('check_email');
    }
    return claim();
  }

  // The seller can take the listing down themselves, no account needed (the link is the proof).
  async function remove() {
    setRemoving(true);
    setError(null);
    const res = await fetch(`/api/claim/${params.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove' })
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setRemoving(false);
    if (!res?.ok) return setError(json.error ?? 'Couldn’t remove it just now. Please try again.');
    setStatus('removed');
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

  if (status === 'removed') {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <h1 className="font-serif text-2xl mb-2">Your listing has been removed</h1>
        <p className="text-saddle-muted">
          Your {saddleName} is no longer on SaddleUp. Thanks for letting us know, and good luck with the sale! If you change your
          mind, you can list it any time at saddleup.me.
        </p>
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
      <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-saddle-gold mb-2">
        Free listing · Beta pricing: {SELLER_FEE_PERCENT}% fee
      </div>
      <h1 className="font-serif text-3xl text-saddle-ink mb-3">Your saddle is ready to sell</h1>
      {viewerIsImporter && (
        <p className="mb-4 rounded border border-saddle-line bg-saddle-sand p-3 text-sm text-saddle-ink">
          <strong>Seller&apos;s view.</strong> You&apos;re signed in as {signedInEmail ?? 'an importer'}, so there&apos;s no claim
          button here (it would claim the saddle into your account). The seller sees a sign-up form instead.
        </p>
      )}
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
          {treeWidthText(listing!.tree_width)} · $
          {(listing!.price_cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </div>
        {listingUrl ? (
          <a
            href={listingUrl}
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex items-center gap-1 rounded-sm border border-saddle-brown px-3 py-2 text-sm font-semibold text-saddle-brown hover:bg-saddle-brown hover:text-saddle-cream"
          >
            See your listing as buyers do <span aria-hidden>↗</span>
          </a>
        ) : (
          <p className="mt-3 text-xs text-saddle-muted">Buyers can&apos;t see it yet. It goes on the site once you claim it.</p>
        )}
      </div>
      <div className="mb-5 text-sm">
        {!confirmRemove ? (
          <p className="text-saddle-muted">
            Don&apos;t want it on SaddleUp?{' '}
            <button type="button" onClick={() => setConfirmRemove(true)} className="underline text-saddle-brown">
              Remove my listing
            </button>
          </p>
        ) : (
          <div className="rounded border border-saddle-line bg-saddle-paper p-3">
            <p className="text-saddle-ink mb-3">Remove your {saddleName} from SaddleUp? It comes off the site right away.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={removing}
                className="rounded-sm bg-saddle-brown text-saddle-cream px-4 py-2 font-semibold disabled:opacity-60"
              >
                {removing ? 'Removing…' : 'Yes, remove it'}
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="rounded-sm border border-saddle-line px-4 py-2">
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="text-saddle-body mb-4">
        We set up a free listing for your saddle on SaddleUp, the saddle marketplace built around fit.{' '}
        {images.length
          ? 'It already has your photos and details, so claiming takes about a minute: check everything, add any photos you like, and save'
          : 'Claim it, add a few photos and check the details'}
        {' '}— it goes live after a quick review. No obligation: keep it listed elsewhere too, and if it sells there first, just remove it here.
      </p>
      <ul className="space-y-3 mb-6">
        {PERKS.map(([title, body]) => (
          <li key={title} className="flex gap-3">
            <span className="text-saddle-green font-semibold" aria-hidden>
              ✓
            </span>
            <span className="text-sm">
              <strong className="text-saddle-ink">{title}.</strong> <span className="text-saddle-body">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      {error && <p className="text-red-700 text-sm mb-3">{error}</p>}

      {viewerIsImporter ? null : signedInEmail ? (
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
          {typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('auto') && (
            <p className="mb-4 rounded border border-saddle-green bg-saddle-paper p-3 text-sm text-saddle-ink">
              <strong>Your email is confirmed.</strong> Enter the same email and password below (or use Google) to finish claiming
              your saddle.
            </p>
          )}
          <GoogleButton next={`/claim/${params.token}?auto=1`} label="Claim with Google" />
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
