// Usage: node scripts/send-claim-invites.mjs claim-invites.csv
// Sends each seller a personal email with their claim link. Uses Resend.
// Rate-limited deliberately (1 every 2s) to keep this looking like real
// outreach, not a spam blast, and to stay within provider rate limits.

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const csvPath = process.argv[2] ?? 'claim-invites.csv';
const rows = parse(fs.readFileSync(csvPath), { columns: true, skip_empty_lines: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const row of rows) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: row.seller_email,
      subject: `A free listing for your saddle on SaddleUp`,
      html: `
        <p>Hi ${row.seller_name || 'there'},</p>
        <p>We set up a free listing for your saddle on SaddleUp, a marketplace built specifically
        for buying and selling used saddles. Claiming it costs nothing and there's no obligation
        to sell here — it just puts your saddle in front of buyers searching by exact fit.</p>
        <p><a href="${row.claim_url}">Claim your listing</a></p>
        <p>If you'd rather not have this listed, just ignore this email and it will never go live.</p>
      `
    });
    console.log(`Sent to ${row.seller_email}`);
  } catch (e) {
    console.error(`Failed for ${row.seller_email}:`, e.message);
  }
  await sleep(2000);
}
