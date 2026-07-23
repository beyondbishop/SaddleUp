# SaddleUp — Deployment Guide

This is a complete Next.js marketplace app. You don't need to touch code to launch it —
follow these steps in order. Total time: roughly 1–2 hours the first time.

## 1. Create a Supabase project (your database + auth + file storage)

1. Go to https://supabase.com → New Project. Name it `saddleup`, set a strong database
   password (save it somewhere), pick a region close to you.
2. Once it's created, go to **SQL Editor → New query**, paste the entire contents of
   `supabase/schema.sql` from this project, and click **Run**. This creates every table,
   security rule, and the matching logic.
3. Go to **Storage** and confirm a bucket called `saddle-images` now exists (the schema
   script creates it). If it's missing, create it manually and mark it **Public**.
4. Go to **Project Settings → API**. Copy three values — you'll need them in Step 4:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — never put it
     in frontend code)

## 2. Create a Stripe account (payments + commission split)

1. Go to https://dashboard.stripe.com → sign up (use test mode first, switch to live later).
2. Go to **Developers → API keys**. Copy:
   - `Secret key` → `STRIPE_SECRET_KEY`
   - `Publishable key` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Go to **Connect → Settings** and enable Connect (choose "Express" accounts) — this is
   what lets each seller get paid directly while you keep your 20% commission automatically.
4. You'll set up the webhook (`STRIPE_WEBHOOK_SECRET`) in Step 5, after the site is live,
   because Stripe needs your real deployed URL.

## 3. Set up email sending (watchlist alerts + claim invites)

1. Go to https://resend.com → sign up, verify a sending domain (or use their test domain
   to start). Create an API key → `RESEND_API_KEY`.
2. Set `EMAIL_FROM` to something like `SaddleUp <notifications@yourdomain.com>`.

## 4. Deploy to Vercel

1. Push this project to a GitHub repo (create a new repo, then from this folder:
   `git init && git add . && git commit -m "initial" && git remote add origin <your repo url> && git push -u origin main`).
2. Go to https://vercel.com → **Add New Project** → import that GitHub repo.
3. Before deploying, add these Environment Variables (Project Settings → Environment
   Variables) — paste in everything from your `.env.example`, filled in with real values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET` (leave blank for now, you'll add it in Step 5)
   - `STRIPE_CONNECT_CLIENT_ID` (from Stripe Connect settings)
   - `COMMISSION_PERCENT=20`
   - `COMMISSION_CAP_CENTS=50000`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `NEXT_PUBLIC_SITE_URL` (your Vercel URL for now, e.g. `https://saddleup.vercel.app`;
     update this once you connect a custom domain)
   - `CRON_SECRET` (make up any random long string)
4. Click **Deploy**. In a couple minutes you'll have a live URL.

## 5. Connect the Stripe webhook (finishes the payment loop)

1. In Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://your-deployed-url.vercel.app/api/stripe/webhook`
3. Select these events: `checkout.session.completed`, `account.updated`
4. Save, then copy the **Signing secret** → add it to Vercel as `STRIPE_WEBHOOK_SECRET`,
   then redeploy (Vercel → Deployments → ⋯ → Redeploy) so it picks up the new value.

## 6. Connect your domain

1. Buy `saddleup.com` (or whatever you land on) via any registrar (Namecheap, Google
   Domains successor Squarespace Domains, etc.).
2. In Vercel → your project → **Settings → Domains** → add your domain and follow the
   DNS instructions it gives you.
3. Update `NEXT_PUBLIC_SITE_URL` in Vercel env vars to your real domain, redeploy.

## 7. Seed your first listings (the Facebook-alternative workflow)

Scraping Facebook isn't something I can build — it violates their terms and republishes
people's photos without consent. Here's the compliant version that gets you the same
outcome:

1. You (or a VA) manually copy details of public saddle-for-sale posts into a CSV with
   these columns: `seller_email,seller_name,brand,model,discipline,seat_size,tree_width,price,description,image_url,city,state`
2. On your own computer (not Vercel), run:
   ```
   npm install
   node scripts/seed-listings.mjs saddles.csv
   ```
   This creates draft listings in your database and writes `claim-invites.csv` with a
   unique claim link per seller.
3. Run:
   ```
   node scripts/send-claim-invites.mjs claim-invites.csv
   ```
   This emails each seller their personal claim link. The listing only goes fully live
   once *they* claim it — meaning they've actively agreed to be listed.

Do this in small batches (20–50 at a time) rather than all at once, both because it reads
as genuine outreach rather than spam, and because you'll want to see how the claim rate
looks before doing more.

## 8. Turn on the watchlist cron

Already configured in `vercel.json` to run every 30 minutes automatically once deployed.
A second cron (`/api/cron/release-payouts`) runs daily and auto-releases seller payouts once
the 5-day inspection window has passed.

## 9. Give yourself admin access (for the listing moderation queue)

New listings go into "pending review" until an admin approves them. To make your account
an admin, run this in Supabase SQL Editor after you've signed up on the live site:
```sql
update profiles set is_admin = true where email = 'you@yourdomain.com';
```
Then visit `/admin/listings` while signed in to approve or reject pending listings.

## What's now built in (trust & safety must-haves)

- **Buyer-seller messaging** — an "Ask a Question" thread on every listing, plus a `/messages` inbox
- **5-day inspection/trial window** — buyer's payment is held by Stripe and only transferred to
  the seller once they confirm receipt (`/orders/[id]`) or the window elapses (automatic daily cron)
- **Seller reviews** — buyers can rate + review after a completed order; shown on `/sellers/[id]`
- **Admin moderation queue** — `/admin/listings`, new listings require approval before going live
- **Terms of Service, Privacy Policy, and Seller Agreement** pages (linked in the footer) —
  these are placeholder templates; have a lawyer review and customize them, and talk to your
  accountant about marketplace-facilitator sales tax obligations before processing real sales.


## Local development (optional, if you want to preview changes before deploying)

```
npm install
cp .env.example .env.local   # fill in the same values as Vercel
npm run dev
```
Then open http://localhost:3000
