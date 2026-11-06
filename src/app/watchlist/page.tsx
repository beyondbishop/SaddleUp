import { redirect } from 'next/navigation';

// Saved searches are now lists with filters ("Save this search as a list" on the browse page).
export default function WatchlistPage() {
  redirect('/lists');
}
