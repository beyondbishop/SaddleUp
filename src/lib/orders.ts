// Order lifecycle helpers for server code. Plain rules and labels live in order-rules.ts
// (safe for browser components) and are re-exported here.
import { createAdminClient } from '@/lib/supabase/server';

export * from '@/lib/order-rules';

export type Actor = 'buyer' | 'seller' | 'admin' | 'system';

/** Append to an order's permanent history. Never throws: history must not block money movement. */
export async function logOrderEvent(orderId: string, type: string, actor: Actor, actorId?: string | null, data?: Record<string, unknown>) {
  const { error } = await createAdminClient()
    .from('order_events')
    .insert({ order_id: orderId, type, actor, actor_id: actorId ?? null, data: data ?? null });
  if (error) console.error(`Could not log order event ${type} for ${orderId}`, error);
}

