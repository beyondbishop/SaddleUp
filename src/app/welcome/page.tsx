import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { avatarUrlFor, hasUploadedAvatar, initialsOf } from '@/lib/avatar';
import { memberZip, placeForZip } from '@/lib/distance';
import { safeNext } from '@/lib/safe-next';
import { claimPendingListing, claimedEditUrl } from '@/lib/pending-claim';
import { INTENTS, type Intent } from '@/lib/onboarding';
import { MESSAGE_SMS_CONSENT_FROM, SMS_CONSENT_TEXT, verifyConfigured } from '@/lib/messaging';
import Onboarding from '@/components/onboarding/Onboarding';
import type { Discipline } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Welcome', robots: { index: false } };

// Every sign-up and sign-in comes through here. New members get the welcome steps
// (looking or selling, discipline, ZIP, photo, cell phone); everyone else goes straight on.
export default async function WelcomePage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  // A saddle they started claiming in another browser: claim it and take them straight to it.
  const claimedId = await claimPendingListing(user);
  if (claimedId) redirect(claimedEditUrl(claimedId));

  const { data: p, error } = await supabase
    .from('profiles')
    .select('full_name, phone, phone_verified_at, sms_opt_in_at, sms_opt_out_at, sms_consent_version, member_intent, disciplines, onboarded_at')
    .eq('id', user.id)
    .maybeSingle();
  // Already done (or the onboarding columns aren't there yet): carry on to where they were going.
  if (error || !p || p.onboarded_at) redirect(next);

  const zip = (await memberZip(supabase, user)) ?? '';
  const intent = INTENTS.includes(p.member_intent as Intent) ? (p.member_intent as Intent) : null;
  const textsOn =
    !!p.phone_verified_at && !!p.sms_opt_in_at && !p.sms_opt_out_at && (p.sms_consent_version ?? '') >= MESSAGE_SMS_CONSENT_FROM;

  return (
    <Onboarding
      next={next}
      firstName={p.full_name?.trim().split(/\s+/)[0] ?? null}
      initial={{
        intent,
        disciplines: (p.disciplines as Discipline[] | null) ?? [],
        zip,
        place: zip ? placeForZip(zip) : null,
        avatarUrl: avatarUrlFor(user),
        hasPhoto: hasUploadedAvatar(user),
        initials: initialsOf(p.full_name, user.email),
        phone: p.phone ?? null,
        phoneVerified: !!p.phone_verified_at,
        textsOn
      }}
      verifyAvailable={verifyConfigured()}
      consentText={SMS_CONSENT_TEXT}
    />
  );
}
