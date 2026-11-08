import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { avatarUrlFor, hasUploadedAvatar, initialsOf } from '@/lib/avatar';
import HeadshotUploader from '@/components/account/HeadshotUploader';
import HomeZipField from '@/components/account/HomeZipField';
import { memberZip, placeForZip } from '@/lib/distance';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your profile', robots: { index: false } };

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/account/profile');
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  // Show the ZIP distances currently use (theirs, or one taken from their address or listings).
  const zip = (await memberZip(supabase, user)) ?? '';

  return (
    <div className="py-10 max-w-lg">
      <h1 className="font-serif text-3xl text-saddle-ink mb-6">Your profile</h1>
      <h2 className="font-semibold mb-1">Your photo</h2>
      <p className="text-sm text-saddle-muted mb-4">
        Your headshot shows on every saddle you list, so buyers can see who they’re buying from.
        A clear, friendly photo of your face works best. With your horse is even better.
      </p>
      <HeadshotUploader
        initialUrl={avatarUrlFor(user)}
        uploaded={hasUploadedAvatar(user)}
        initials={initialsOf(profile?.full_name, user.email)}
      />
      <div className="mt-10">
        <HomeZipField initialZip={zip} place={zip ? placeForZip(zip) : null} />
      </div>
    </div>
  );
}
