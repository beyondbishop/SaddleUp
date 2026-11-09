-- Reviews at the end of a sale, from both sides, that can be shared on the site.
--   * The buyer rates the seller and the experience; the seller rates SaddleUp (no reviewee).
--   * share_ok: the reviewer said SaddleUp may quote it (first name only) on the website.
--   * hidden: an admin took it off the website (not quoted, not counted in public ratings).
--   * reviewer_first_name / saddle_label: saved when written, so the quote shows without
--     reading private profiles or listings.
-- Writes go through /api/reviews (service key) after checking the order; the old direct-insert
-- policy is replaced.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table reviews add column if not exists reviewer_role text not null default 'buyer';
alter table reviews add column if not exists share_ok boolean not null default false;
alter table reviews add column if not exists hidden boolean not null default false;
alter table reviews add column if not exists reviewer_first_name text;
alter table reviews add column if not exists saddle_label text;

do $$ begin
  alter table reviews add constraint reviews_reviewer_role_check check (reviewer_role in ('buyer', 'seller'));
exception when duplicate_object then null; end $$;

-- One review per side per order (was one per order).
alter table reviews drop constraint if exists reviews_order_id_key;
create unique index if not exists reviews_order_role_key on reviews (order_id, reviewer_role);

drop policy if exists "buyers review their own completed orders" on reviews;

create index if not exists idx_reviews_featured on reviews (created_at desc) where rating = 5 and share_ok and not hidden;
