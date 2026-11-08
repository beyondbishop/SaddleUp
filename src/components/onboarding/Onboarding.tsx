'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HeadshotUploader from '@/components/account/HeadshotUploader';
import { createClient } from '@/lib/supabase/client';
import { ALL_DISCIPLINES, INTENT_LABELS, INTENTS, afterOnboarding, type Intent } from '@/lib/onboarding';
import { DISCIPLINE_LABELS, type Discipline } from '@/lib/types';

type Props = {
  next: string;
  firstName: string | null;
  initial: {
    intent: Intent | null;
    disciplines: Discipline[];
    zip: string;
    place: string | null;
    avatarUrl: string | null;
    hasPhoto: boolean;
    initials: string;
    phone: string | null;
    phoneVerified: boolean;
    textsOn: boolean;
  };
  verifyAvailable: boolean;
  consentText: string;
};

const STEPS = ['intent', 'discipline', 'zip', 'photo', 'phone'] as const;
type Step = (typeof STEPS)[number];

const primary = 'bg-saddle-green text-white rounded-md px-5 py-2.5 font-semibold disabled:opacity-50';
const quiet = 'text-saddle-muted underline underline-offset-2 px-2 py-2.5';
const pretty = (p: string | null) => (p && /^\+1\d{10}$/.test(p) ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : p ?? '');

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  return { ok: !!res?.ok, data: data ?? {} };
}

export default function Onboarding({ next, firstName, initial, verifyAvailable, consentText }: Props) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const step: Step = STEPS[i];
  const [intent, setIntent] = useState<Intent | null>(initial.intent);
  const [disciplines, setDisciplines] = useState<Discipline[]>(initial.disciplines);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zip, setZip] = useState(initial.zip);

  // Phone step
  const [phone, setPhone] = useState(pretty(initial.phone));
  const [savedPhone, setSavedPhone] = useState(initial.phone);
  const [verified, setVerified] = useState(initial.phoneVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [textsOn, setTextsOn] = useState(initial.textsOn);
  const [note, setNote] = useState<string | null>(null);

  const selling = intent === 'selling' || intent === 'both';

  // Start each step at the top, so the step counter and heading are in view.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [i]);

  async function finish() {
    setBusy(true);
    await post('/api/account/onboarding', { done: true });
    router.push(afterOnboarding(next, intent));
    router.refresh();
  }

  async function advance() {
    setError(null);
    if (step === 'intent' && intent) {
      setBusy(true);
      const r = await post('/api/account/onboarding', { intent });
      setBusy(false);
      if (!r.ok) return setError(r.data.error ?? 'Could not save. Please try again.');
    }
    if (step === 'zip' && zip.trim() !== initial.zip) {
      const clean = zip.trim();
      if (clean && !/^\d{5}$/.test(clean)) return setError('Please enter a 5-digit ZIP code.');
      setBusy(true);
      const { error: zipError } = await createClient().auth.updateUser({ data: { home_zip: clean || null } });
      document.cookie = 'su_zip=; path=/; max-age=0'; // a ZIP typed in the browse filters would otherwise win
      setBusy(false);
      if (zipError) return setError('Could not save your ZIP code. Please try again.');
    }
    if (step === 'phone' && !savedPhone && phone.trim()) {
      // Typed a number but didn't ask for a code: keep it so they can confirm it later.
      setBusy(true);
      const r = await post('/api/account/phone', { action: 'save', phone });
      setBusy(false);
      if (!r.ok) return setError(r.data.error ?? 'Could not save your number. Please try again.');
    }
    if (step === 'discipline') {
      setBusy(true);
      const r = await post('/api/account/onboarding', { disciplines });
      setBusy(false);
      if (!r.ok) return setError(r.data.error ?? 'Could not save. Please try again.');
    }
    if (i === STEPS.length - 1) return finish();
    setI(i + 1);
  }

  async function sendCode() {
    setError(null);
    setNote(null);
    setBusy(true);
    const action = verifyAvailable ? 'send' : 'save';
    const r = await post('/api/account/phone', { action, phone });
    setBusy(false);
    if (r.data.phone) setSavedPhone(r.data.phone);
    if (!r.ok) return setError(r.data.error ?? 'That didn’t work. Please try again.');
    if (verifyAvailable) {
      setCodeSent(true);
      setNote(`We texted a code to ${pretty(r.data.phone)}.`);
    } else {
      setNote('Saved. Text alerts are coming soon; we’ll use this number then.');
    }
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await post('/api/account/phone', { action: 'verify', code });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? 'That code didn’t match. Try again.');
    setVerified(true);
    setNote(null);
  }

  async function turnOnTexts() {
    setError(null);
    setBusy(true);
    const r = await post('/api/account/sms', { optIn: true, consent: true });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? 'That didn’t work. Please try again.');
    setTextsOn(true);
  }

  const toggle = (d: Discipline) => setDisciplines((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <div className="py-10 max-w-lg mx-auto">
      <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-saddle-gold">
        Step {i + 1} of {STEPS.length}
      </p>
      <div className="flex gap-1.5 mt-2 mb-6" aria-hidden>
        {STEPS.map((s, n) => (
          <span key={s} className={`h-1.5 flex-1 rounded-full ${n <= i ? 'bg-saddle-green' : 'bg-saddle-line'}`} />
        ))}
      </div>

      {step === 'intent' && (
        <section className="space-y-4">
          <h1 className="font-serif text-3xl text-saddle-ink">Welcome{firstName ? `, ${firstName}` : ''}! What brings you to SaddleUp?</h1>
          <p className="text-saddle-muted">We’ll set things up around what you’re here to do. You can always do both.</p>
          <div className="grid gap-3" role="radiogroup" aria-label="What brings you here">
            {INTENTS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={intent === k}
                onClick={() => setIntent(k)}
                className={`text-left border rounded-lg p-4 transition-colors ${
                  intent === k ? 'border-saddle-green bg-saddle-green/5 ring-1 ring-saddle-green' : 'border-saddle-line bg-white hover:border-saddle-green'
                }`}
              >
                <span className="font-semibold block">{INTENT_LABELS[k]}</span>
                <span className="text-sm text-saddle-muted">
                  {k === 'buying' && 'Browse saddles by seat size, tree width and discipline, and save searches.'}
                  {k === 'selling' && 'List a saddle in a few minutes. We help with pricing, shipping and getting paid.'}
                  {k === 'both' && 'Selling one saddle and looking for the next.'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'discipline' && (
        <section className="space-y-4">
          <h1 className="font-serif text-3xl text-saddle-ink">What do you ride?</h1>
          <p className="text-saddle-muted">Pick all that apply. We’ll show you the saddles that fit.</p>
          <div className="flex flex-wrap gap-2">
            {ALL_DISCIPLINES.map((d) => {
              const on = disciplines.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    on ? 'bg-saddle-green text-white border-saddle-green' : 'bg-white border-saddle-line text-saddle-ink hover:border-saddle-green'
                  }`}
                >
                  {DISCIPLINE_LABELS[d]}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 'zip' && (
        <section className="space-y-4">
          <h1 className="font-serif text-3xl text-saddle-ink">Where are you based?</h1>
          <p className="text-saddle-muted">
            So we can show how far each saddle is from you. It’s only used for distances and never shown to anyone.
          </p>
          <label htmlFor="ob-zip" className="sr-only">ZIP code</label>
          <input id="ob-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="ZIP code, e.g. 27514" value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); advance(); } }}
            className="border border-saddle-line rounded p-2 w-40 bg-white" />
          {initial.place && zip === initial.zip && <p className="text-sm text-saddle-muted">{initial.place}</p>}
        </section>
      )}

      {step === 'photo' && (
        <section className="space-y-4">
          <h1 className="font-serif text-3xl text-saddle-ink">Add a photo of you</h1>
          <p className="text-saddle-muted">
            {selling
              ? 'Your photo shows on every saddle you list. Buyers are much more comfortable buying from a real face. With your horse is even better.'
              : 'Sellers see it when you message them, so they know they’re talking to a real rider.'}
          </p>
          <HeadshotUploader initialUrl={initial.avatarUrl} uploaded={initial.hasPhoto} initials={initial.initials} />
        </section>
      )}

      {step === 'phone' && (
        <section className="space-y-4">
          <h1 className="font-serif text-3xl text-saddle-ink">Never miss a message</h1>
          <p className="text-saddle-muted">
            {selling
              ? 'Get a text the moment a buyer asks about your saddle. Riders often message a few sellers at once, so a quick reply wins the sale.'
              : 'Get a text when a seller replies, so you don’t miss the saddle.'}
          </p>

          {!verified ? (
            <>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendCode();
                }}
              >
                <label htmlFor="ob-phone" className="sr-only">Cell phone</label>
                <input id="ob-phone" type="tel" autoComplete="tel" placeholder="Cell phone, e.g. (919) 555-0123" value={phone}
                  onChange={(e) => setPhone(e.target.value)} required
                  className="border border-saddle-line rounded p-2 flex-1 min-w-0 bg-white" />
                <button type="submit" disabled={busy} className="border border-saddle-green text-saddle-green rounded-md px-4 font-semibold text-sm disabled:opacity-50">
                  {verifyAvailable ? (codeSent ? 'Resend' : 'Text me a code') : 'Save'}
                </button>
              </form>
              {codeSent && (
                <form onSubmit={checkCode} className="flex gap-2 items-end">
                  <label className="flex-1">
                    <span className="block text-sm font-semibold mb-1">Code</span>
                    <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required
                      className="border border-saddle-line rounded p-2 w-full bg-white" />
                  </label>
                  <button type="submit" disabled={busy} className={primary}>Confirm</button>
                </form>
              )}
            </>
          ) : textsOn ? (
            <p className="text-saddle-green font-semibold">You’re all set. Texts go to {pretty(savedPhone)}.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">Confirmed: <strong>{pretty(savedPhone)}</strong></p>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                <span>
                  {consentText} <a href="/terms#text-messages" className="underline" target="_blank">Terms</a> ·{' '}
                  <a href="/privacy#text-messages" className="underline" target="_blank">Privacy</a>
                </span>
              </label>
              <button type="button" disabled={busy || !consent} onClick={turnOnTexts} className={primary}>
                Turn on text alerts
              </button>
            </div>
          )}
          {note && <p role="status" className="text-sm text-saddle-green">{note}</p>}
          <p className="text-xs text-saddle-muted">US numbers only. We never share your number. You can change this anytime on your profile.</p>
        </section>
      )}

      {error && <p role="alert" className="text-sm text-red-700 mt-4">{error}</p>}

      <div className="flex items-center justify-between mt-8">
        {i > 0 ? (
          <button type="button" onClick={() => { setError(null); setI(i - 1); }} className={quiet}>Back</button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => (i === STEPS.length - 1 ? finish() : setI(i + 1))} disabled={busy} className={quiet}>
            {i === STEPS.length - 1 ? 'Skip and finish' : 'Skip'}
          </button>
          <button type="button" onClick={advance} disabled={busy || (step === 'intent' && !intent)} className={primary}>
            {i === STEPS.length - 1 ? 'Finish' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
