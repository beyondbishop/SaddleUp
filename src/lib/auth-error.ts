// Supabase auth errors aren't always readable: a server timeout comes through as "{}", and email
// problems as "Error sending confirmation email". Turn them into something a rider can act on.

export function authErrorText(error: { message?: string; status?: number } | null | undefined): string {
  const msg = (error?.message ?? '').trim();
  if (/sending (confirmation|recovery|magic link|invite)? ?email/i.test(msg)) {
    return "We couldn't send your confirmation email just now. Please try again in a few minutes, or email hello@saddleup.me and we'll set you up.";
  }
  if (!msg || msg === '{}' || (error?.status ?? 0) >= 500) {
    return 'Something went wrong on our end. Please try again in a minute, or email hello@saddleup.me if it keeps happening.';
  }
  return msg;
}
