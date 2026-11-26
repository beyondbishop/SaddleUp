import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { shortWhen, type InboxThread } from '@/lib/inbox';

/** Two panes on desktop (people on the left, the open thread on the right); one at a time on phones. */
export default function InboxShell({
  threads,
  userId,
  activeOtherId,
  children
}: {
  threads: InboxThread[];
  userId: string;
  activeOtherId: string | null;
  children: React.ReactNode;
}) {
  const now = new Date();
  return (
    <div className="py-6">
      <h1 className={`text-2xl font-bold text-saddle-brown mb-4 ${activeOtherId ? 'hidden md:block' : ''}`}>Messages</h1>
      <div className="bg-white border border-saddle-line rounded-lg overflow-hidden md:grid md:grid-cols-[minmax(16rem,22rem)_1fr] md:h-[calc(100vh-14rem)] md:min-h-[32rem]">
        <nav aria-label="Conversations" className={`md:border-r border-saddle-line md:overflow-y-auto ${activeOtherId ? 'hidden md:block' : ''}`}>
          {threads.length === 0 ? (
            <p className="p-6 text-sm text-saddle-muted">
              No conversations yet. Ask a seller a question from any saddle&apos;s page and it shows up here.
            </p>
          ) : (
            <ul>
              {threads.map((t) => {
                const active = t.otherId === activeOtherId;
                const last = t.lastMessage;
                const preview = last ? `${last.sender_id === userId ? 'You: ' : ''}${last.body}` : 'No messages yet';
                return (
                  <li key={t.otherId} className="border-b border-saddle-line last:border-b-0">
                    <Link
                      href={`/messages/${t.latestConversationId}`}
                      aria-current={active ? 'page' : undefined}
                      className={`flex gap-3 p-4 border-l-4 transition-colors ${
                        active ? 'bg-saddle-sand border-saddle-green' : 'border-transparent hover:bg-saddle-cream'
                      }`}
                    >
                      <Avatar url={t.avatarUrl} initials={t.initials} size={48} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-saddle-ink ${t.unread ? 'font-bold' : 'font-semibold'}`}>
                            {t.name}
                            {t.isSaddleUp && <span className="ml-1 text-xs font-normal text-saddle-muted">· SaddleUp</span>}
                          </span>
                          <span className={`text-xs shrink-0 ${t.unread ? 'text-saddle-green font-semibold' : 'text-saddle-muted'}`}>
                            {shortWhen(t.lastAt, now)}
                          </span>
                        </span>
                        <span className="block text-xs text-saddle-brown truncate">
                          {t.saddles[0]?.label}
                          {t.saddles.length > 1 && ` +${t.saddles.length - 1} more`}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={`text-sm line-clamp-2 flex-1 ${t.unread ? 'text-saddle-ink font-medium' : 'text-saddle-muted'}`}>{preview}</span>
                          {t.unread > 0 && (
                            <span className="shrink-0 text-xs bg-red-700 text-white rounded-full min-w-5 h-5 px-1.5 inline-flex items-center justify-center">
                              {t.unread}
                              <span className="sr-only"> unread</span>
                            </span>
                          )}
                        </span>
                        {t.saddles.some((s) => s.unclaimedForMe) && (
                          <span className="mt-1 inline-block text-xs bg-saddle-sand text-saddle-muted rounded-full px-2 py-0.5">
                            Unclaimed: pass to seller
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        <section className={`min-w-0 md:flex md:flex-col md:h-full md:min-h-0 md:overflow-hidden ${activeOtherId ? '' : 'hidden md:flex'}`}>{children}</section>
      </div>
    </div>
  );
}
