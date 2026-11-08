import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { avatarUrlFor, hasUploadedAvatar, initialsOf } from '@/lib/avatar';
import HeadshotUploader from '@/components/account/HeadshotUploader';
import HomeZipField from '@/components/account/HomeZipField';
import NameField from '@/components/account/NameField';
import PhoneField from '@/components/account/PhoneField';
import NotificationPrefs from '@/components/account/NotificationPrefs';
import TextSettings from '@/components/account/TextSettings';
import InterestsField from '@/components/account/InterestsField';
import type { Intent } from '@/lib/onboarding';
import type { Discipline } from '@/lib/types';
import { memberZip, placeForZip } from '@/lib/distance';
import { readPrefs } from '@/lib/notification-prefs';
import { MESSAGE_SMS_CONSENT_FROM, SMS_CONSENT_TEXT, emailConfigured, verifyConfigured } from '@/lib/messaging';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your profile', robots: { index: false } };

const card = 'bg-white border border-saddle-line rounded-lg p-5 space-y-4';
const h2 = 'font-serif text-xl text-saddle-ink';

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/account/profile');
  const [{ data: p }, prefs, zip, { data: interests }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, phone, phone_verified_at, sms_opt_in_at, sms_opt_out_at, sms_consent_version')
      .eq('id', user.id)
      .maybeSingle(),
    readPrefs(supabase, [user.id]).then((m) => m.get(user.id)!),
    // Show the ZIP distances currently use (theirs, or one taken from their address or listings).
    memberZip(supabase, user).then((z) => z ?? ''),
    // Separate read so the page still works if the onboarding columns aren't there yet.
    supabase.from('profiles').select('member_intent, disciplines').eq('id', user.id).maybeSingle()
  ]);

  const textsOn = !!p?.phone_verified_at && !!p?.sms_opt_in_at && !p?.sms_opt_out_at;
  const messageTextsAllowed = textsOn && (p?.sms_consent_version ?? '') >= MESSAGE_SMS_CONSENT_FROM;

  return (
    <div className="py-10 max-w-xl space-y-6">
      <h1 className="font-serif text-3xl text-saddle-ink">Your profile</h1>

      <section className={card}>
        <h2 className={h2}>Your photo</h2>
        <p className="text-sm text-saddle-muted">
          Your headshot shows on every saddle you list, so buyers can see who they’re buying from.
          A clear, friendly photo of your face works best. With your horse is even better.
        </p>
        <HeadshotUploader
          initialUrl={avatarUrlFor(user)}
          uploaded={hasUploadedAvatar(user)}
          initials={initialsOf(p?.full_name, user.email)}
        />
      </section>

      <section className={card}>
        <h2 className={h2}>Your details</h2>
        <NameField userId={user.id} initialName={p?.full_name ?? ''} />
        <InterestsField
          initialIntent={(interests?.member_intent as Intent | null) ?? null}
          initialDisciplines={(interests?.disciplines as Discipline[] | null) ?? []}
        />
        <div>
          <p className="font-semibold">Email</p>
          <p className="text-sm">{p?.email ?? user.email}</p>
          <p className="text-sm text-saddle-muted">
            To change it, <a href="mailto:danielle@saddleup.me" className="underline">email me</a> and I’ll update it for you.
          </p>
        </div>
        <PhoneField initialPhone={p?.phone ?? null} verified={!!p?.phone_verified_at} />
        <HomeZipField initialZip={zip} place={zip ? placeForZip(zip) : null} />
      </section>

      <section id="notifications" className={`${card} scroll-mt-6`}>
        <div>
          <h2 className={h2}>Notifications</h2>
          <p className="text-sm text-saddle-muted mt-1">
            Choose what we send you and how. Emails go to <strong className="text-saddle-ink">{p?.email ?? user.email}</strong>.
          </p>
          {!emailConfigured() && <p className="text-xs text-saddle-muted">Email sending is being set up.</p>}
        </div>
        <NotificationPrefs initial={prefs} textsOn={textsOn} messageTextsAllowed={messageTextsAllowed} />

        <div className="border-t border-saddle-line pt-4 space-y-3">
          <h3 className="font-semibold">Text messages</h3>
          <TextSettings
            phone={p?.phone ?? null}
            verified={!!p?.phone_verified_at}
            textsOn={textsOn}
            needsMessageConsent={textsOn && !messageTextsAllowed}
            optedOutByReply={!!p?.sms_opt_out_at && !p?.sms_opt_in_at}
            verifyAvailable={verifyConfigured()}
            consentText={SMS_CONSENT_TEXT}
          />
        </div>
      </section>
    </div>
  );
}
