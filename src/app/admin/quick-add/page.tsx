import { redirect } from 'next/navigation';

// Quick add moved to /imports/new so importers (not only admins) can use it.
export default function QuickAddPage() {
  redirect('/imports/new');
}
