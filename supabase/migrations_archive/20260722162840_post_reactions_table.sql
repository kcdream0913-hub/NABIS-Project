-- post_reactions_table — applied to prod 2026-07-22 (version 20260722162840).
-- Captured retroactively from the live database (columns from pg_attribute,
-- constraints from pg_constraint, policy predicates from pg_policies),
-- cross-checked against ROLLBACK_post_reactions_table.sql.
--
-- One row per (post, user) — a single reaction kind, so the composite primary key
-- IS the uniqueness rule: a user cannot react twice to the same post, and the
-- toggle is a plain insert/delete with no upsert needed.

create table if not exists public.post_reactions (
  post_id    uuid        not null references public.posts(id)   on delete cascade,
  user_id    uuid        not null references auth.users(id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Feed loads reactions for a page of posts via `in (post_id, ...)`.
create index if not exists post_reactions_post_id_idx
  on public.post_reactions using btree (post_id);

alter table public.post_reactions enable row level security;

-- Counts are public to signed-in members (the feed renders totals on every card).
drop policy if exists post_reactions_select on public.post_reactions;
create policy post_reactions_select on public.post_reactions
  for select to authenticated using (true);

-- The client supplies user_id on insert, so WITH CHECK is what makes forging a
-- reaction as another member impossible. Do not relax this.
drop policy if exists post_reactions_insert_own on public.post_reactions;
create policy post_reactions_insert_own on public.post_reactions
  for insert to authenticated with check (user_id = auth.uid());

-- Un-react removes only your own row.
drop policy if exists post_reactions_delete_own on public.post_reactions;
create policy post_reactions_delete_own on public.post_reactions
  for delete to authenticated using (user_id = auth.uid());
