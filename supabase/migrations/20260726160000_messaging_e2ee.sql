-- Messaging Phase 1.5 — end-to-end encryption key storage + encrypted payload.
-- The server stores only ciphertext and WRAPPED keys; it can never derive
-- plaintext. Reactions, read cursors, typing, and timestamps stay plaintext
-- metadata (documented tradeoff).

-- ── public identity keys (ECDH P-256) — world-readable so peers can wrap a
--    thread key FOR you using ECDH(their-priv, your-pub). ──
create table if not exists public.user_keys (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  public_key text not null,               -- base64url raw SPKI / JWK of the P-256 public key
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_keys enable row level security;
create policy user_keys_select_all on public.user_keys
  for select to authenticated using (true);
create policy user_keys_insert_own on public.user_keys
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_keys_update_own on public.user_keys
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── owner-only encrypted private-key backup. Wrapped with a KEK derived from the
--    12-word recovery phrase (PBKDF2). Only the owner can read it, and only the
--    phrase can decrypt it — the server sees an opaque blob. ──
create table if not exists public.user_key_recovery (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  wrapped_private_key text not null,      -- base64 JSON {v,salt,iterations,iv,ct}
  updated_at          timestamptz not null default now()
);
alter table public.user_key_recovery enable row level security;
create policy user_key_recovery_all_own on public.user_key_recovery
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── per-participant wrapped symmetric thread key (AES-GCM-256). One row per
--    (thread, participant); you can only read YOUR OWN wrapped key. ──
create table if not exists public.thread_keys (
  thread_id   uuid not null references public.direct_threads(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,   -- recipient the key is wrapped FOR
  wrapped_key text not null,             -- base64 JSON {iv,ct}; KEK = HKDF(ECDH(wrapped_by priv, user_id pub))
  wrapped_by  uuid not null references auth.users(id),                     -- whose pubkey the recipient uses to unwrap
  created_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists idx_thread_keys_user       on public.thread_keys(user_id);
create index if not exists idx_thread_keys_wrapped_by on public.thread_keys(wrapped_by);
alter table public.thread_keys enable row level security;
-- Read only your own wrapped key. A wrong participant cannot even SELECT another's
-- row (and, even if they could, the KEK is bound to the intended recipient's keypair).
create policy thread_keys_select_own on public.thread_keys
  for select to authenticated using (user_id = (select auth.uid()));
-- Only a thread participant may publish wrapped keys, and only as themselves.
create policy thread_keys_insert_participant on public.thread_keys
  for insert to authenticated
  with check (private.is_thread_participant(thread_id) and wrapped_by = (select auth.uid()));

-- ── encrypted message payload. When schema_version = 1, body holds base64
--    ciphertext and body_iv holds the per-message AES-GCM IV. schema_version was
--    added in Phase 1 (default 0 = legacy plaintext, rendered as-is). ──
alter table public.messages add column if not exists body_iv text;
