import { redirect } from 'next/navigation';

// Notification settings now live in the Notifications section of the profile page.
export default function NotificationSettingsPage() {
  redirect('/account/profile#notifications');
}
