import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, ensureDefaultList } from '@/lib/lists-server';
import NewListForm from '@/components/lists/NewListForm';
import RestoreListButton from '@/components/lists/RestoreListButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My lists', robots: { index: false } };

export default async function ListsPage() {
  const { supabase, user } = await requireUser();
  if (!user) redirect('/auth/login?next=/lists');
  await ensureDefaultList(supabase, user.id);

  const { data: lists } = await supabase
    .from('buyer_lists')
    .select('id, name, description, is_default, archived_at, buyer_list_items(count)')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  const active = (lists ?? []).filter((l) => !l.archived_at);
  const archived = (lists ?? []).filter((l) => l.archived_at);
  const count = (l: any) => l.buyer_list_items?.[0]?.count ?? 0;

  return (
    <div className="py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-saddle-brown mb-1">My lists</h1>
      <p className="text-sm text-gray-600 mb-6">
        Keep a list for each horse or client. A saddle can be on several lists, each with its own private notes.
      </p>

      <NewListForm />

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        {active.map((l) => (
          <li key={l.id}>
            <Link href={`/lists/${l.id}`} className="block bg-white border border-saddle-tan rounded-lg p-4 hover:shadow-md h-full">
              <p className="font-semibold text-saddle-brown">{l.name}</p>
              <p className="text-sm text-gray-500">{count(l)} {count(l) === 1 ? 'saddle' : 'saddles'}</p>
              {l.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{l.description}</p>}
            </Link>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600">Archived lists ({archived.length})</summary>
          <ul className="mt-3 space-y-2">
            {archived.map((l) => (
              <li key={l.id} className="flex items-center justify-between bg-white border border-saddle-line rounded p-3">
                <Link href={`/lists/${l.id}`} className="underline">{l.name}</Link>
                <RestoreListButton id={l.id} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
