import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TextSettings from '@/components/account/TextSettings';
import { SMS_CONSENT_TEXT, emailConfigured, verifyConfigured } from '@/lib/messaging';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications', robots: { index: false } };

export default async function NotificationSettingsPage({ searchParams }: { searchParams: { change?: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/account/notifications');

  const { data: p } = await supabase
    .from('profiles')
    .select('email, phone, phone_verified_at, sms_opt_in_at, sms_opt_out_at')
    .eq('id', user.id)
    .single();

  const changing = searchParams.change === '1';
  return (
    <div className="py-8 max-w-xl space-y-8">
      <h1 className="text-2xl font-bold text-saddle-brown">Notifications</h1>

      <section className="bg-white border border-saddle-tan rounded-lg p-5 space-y-2">
        <h2 className="font-semibold">Email</h2>
        <p className="text-sm">
          Order updates (payment, shipping, delivery, inspection deadlines, returns and payouts) go to{' '}
          <strong>{p?.email ?? user.email}</strong>. These are always on because they&apos;re about money and deadlines.
        </p>
        {!emailConfigured() && <p className="text-xs text-gray-500">Email sending is being set up.</p>}
      </section>

      <section className="bg-white border border-saddle-tan rounded-lg p-5 space-y-3">
        <h2 className="font-semibold">Text messages</h2>
        <p className="text-sm text-gray-700">Get the important ones by text too: shipped, delivered, inspection deadlines and payouts.</p>
        <TextSettings
          phone={p?.phone ?? null}
          verified={!!p?.phone_verified_at && !changing}
          textsOn={!!p?.sms_opt_in_at && !p?.sms_opt_out_at}
          optedOutByReply={!!p?.sms_opt_out_at && !p?.sms_opt_in_at}
          verifyAvailable={verifyConfigured()}
          consentText={SMS_CONSENT_TEXT}
        />
      </section>
    </div>
  );
}
