// Order lifecycle helpers for server code. Plain rules and labels live in order-rules.ts
// (safe for browser components) and are re-exported here.
import { createAdminClient } from '@/lib/supabase/server';
import { notifyOrderEvent } from '@/lib/notify';

export * from '@/lib/order-rules';

export type Actor = 'buyer' | 'seller' | 'admin' | 'system';

/**
 * Append to an order's permanent history, then send that event's emails/texts (each once).
 * Never throws: history and messages must not block money movement.
 */
export async function logOrderEvent(orderId: string, type: string, actor: Actor, actorId?: string | null, data?: Record<string, unknown>) {
  const { error } = await createAdminClient()
    .from('order_events')
    .insert({ order_id: orderId, type, actor, actor_id: actorId ?? null, data: data ?? null });
  if (error) console.error(`Could not log order event ${type} for ${orderId}`, error);
  await notifyOrderEvent(orderId, type, data);
}

/** Record a once-only event (reminders, overdue notices) if it hasn't happened yet. */
export async function logOrderEventOnce(orderId: string, type: string, data?: Record<string, unknown>) {
  const { data: existing } = await createAdminClient()
    .from('order_events')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', type)
    .limit(1);
  if (existing?.length) return false;
  await logOrderEvent(orderId, type, 'system', null, data);
  return true;
}

