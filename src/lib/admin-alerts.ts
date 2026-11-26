// Texts to SaddleUp admins when something new needs a look:
//   - "new_user":    someone just joined (fires once per person, when their email is confirmed)
//   - "new_listing": a seller just added a saddle, and it's waiting in the review queue
// Goes to every admin with a confirmed cell number who hasn't replied STOP.
// Never throws: an alert must never block a sign-up or a listing save.
// Each alert is logged in notification_log (once per admin per event), so a repeat call sends nothing.
import { createAdminClient } from '@/lib/supabase/server';
import { sendSms } from '@/lib/messaging';

export type AdminAlertKind = 'new_user' | 'new_listing';

const RAW_SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me').replace(/\/$/, '');
const SITE = RAW_SITE.includes('localhost') ? 'https://saddleup.me' : RAW_SITE;
const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

async function buildText(kind: AdminAlertKind, id: string): Promise<string | null> {
  const admin = createAdminClient();
  if (kind === 'new_user') {
    const { data: p } = await admin.from('profiles').select('full_name, email').eq('id', id).maybeSingle();
    if (!p) return null;
    const who = [p.full_name?.trim(), p.email].filter(Boolean).join(' · ') || 'Someone';
    return `SaddleUp: new member joined: ${who}. ${SITE}/admin/users`;
  }
  const { data: l } = await admin
    .from('listings')
    .select('status, seat_size, model, price_cents, seller_id, brands(name)')
    .eq('id', id)
    .maybeSingle();
  if (!l) return null;
  if (l.status !== 'draft') return null; // only saddles waiting for review
  const brand = (l.brands as { name?: string } | null)?.name;
  const saddle = `${l.seat_size ? `${l.seat_size}" ` : ''}${brand && brand !== 'Other' ? `${brand} ` : ''}${l.model ?? 'saddle'}`.trim();
  let seller = '';
  if (l.seller_id) {
    const { data: s } = await admin.from('profiles').select('full_name, email').eq('id', l.seller_id).maybeSingle();
    seller = s?.full_name?.trim() || s?.email || '';
  }
  return `SaddleUp: new saddle to review: ${saddle}${l.price_cents ? ` (${usd(l.price_cents)})` : ''}${seller ? ` from ${seller}` : ''}. ${SITE}/admin`;
}

export async function textAdmins(kind: AdminAlertKind, id: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from('profiles')
      .select('id, phone, phone_verified_at, sms_opt_out_at')
      .eq('is_admin', true);
    const reachable = (admins ?? []).filter((a: any) => a.phone && a.phone_verified_at && !a.sms_opt_out_at);
    if (!reachable.length) {
      console.warn(`Admin alert ${kind} ${id}: no admin has a confirmed cell number`);
      return;
    }
    const body = await buildText(kind, id);
    if (!body) return;
    for (const a of reachable) {
      const key = `admin:${kind}:${id}:${a.id}:sms`;
      // Claim this alert first; a repeat call finds the row already there and stops.
      const { data: claimed } = await admin
        .from('notification_log')
        .upsert(
          { dedupe_key: key, order_id: null, user_id: a.id, channel: 'sms', template: `admin_${kind}`, status: 'pending' },
          { onConflict: 'dedupe_key', ignoreDuplicates: true }
        )
        .select('id');
      if (!claimed?.length) continue;
      const result = await sendSms({ to: a.phone, body: body.slice(0, 320) });
      await admin.from('notification_log').update({ status: result.status, detail: result.detail.slice(0, 500) }).eq('dedupe_key', key);
      if (result.status !== 'sent') console.warn(`Admin alert ${kind} ${id} to ${a.id}: ${result.status} (${result.detail})`);
    }
  } catch (e) {
    console.error(`Admin alert ${kind} for ${id} failed`, e);
  }
}
