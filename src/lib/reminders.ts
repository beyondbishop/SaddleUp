// Daily reminders (run by the 9am Eastern job). Each fires at most once per order.
// Because the job runs every 24 hours, each 24-hour window below is hit by exactly one run.
import { createAdminClient } from '@/lib/supabase/server';
import { logOrderEventOnce } from '@/lib/orders';

const HOUR = 3600 * 1000;

export async function sendDailyReminders() {
  const admin = createAdminClient();
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  let sent = 0;

  // Buyers still inspecting (delivered, not kept, no open issue, payout not started).
  const { data: inspecting } = await admin
    .from('orders')
    .select('id, release_at')
    .eq('status', 'paid')
    .eq('payout_status', 'held')
    .is('kept_at', null)
    .is('confirmed_at', null)
    .is('issue_type', null)
    .gt('release_at', iso(now))
    .lte('release_at', iso(now + 48 * HOUR));
  for (const o of inspecting ?? []) {
    const left = new Date(o.release_at).getTime() - now;
    const type = left > 24 * HOUR ? 'inspection_reminder_2d' : 'inspection_reminder_1d';
    if (await logOrderEventOnce(o.id, type)) sent++;
  }

  // Sellers who haven't shipped: due within a day, or overdue.
  const { data: unshipped } = await admin
    .from('orders')
    .select('id, dispatch_due_at')
    .eq('status', 'paid')
    .is('shipped_at', null)
    .is('delivered_at', null)
    .not('dispatch_due_at', 'is', null)
    .lte('dispatch_due_at', iso(now + 24 * HOUR));
  for (const o of unshipped ?? []) {
    const overdue = new Date(o.dispatch_due_at).getTime() < now;
    if (await logOrderEventOnce(o.id, overdue ? 'dispatch_overdue' : 'dispatch_reminder')) sent++;
  }
  return sent;
}
