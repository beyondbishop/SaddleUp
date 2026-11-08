-- Sellers can save a listing without a tree width (many don't know it yet). The listing emails
-- then link them to the measuring guide so they can add it.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listings alter column tree_width drop not null;
