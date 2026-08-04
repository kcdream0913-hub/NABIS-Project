# BL-E2E-SPLIT-01 — baseline + restore runbook (D-085)

The executable checklist for standing up the dedicated `sangamline-e2e` Supabase project as a
faithful copy of prod's SCHEMA. Every number and every line of SQL below was **verified against
prod (`dhnggnxwjgqvghbxelvw`) on 2026-08-04** via `execute_sql`, not asserted from memory.

**Who does what.** The dump (Step 3) needs the prod DB password → **KC only** (password goes into
a terminal, never a file / commit / chat). Everything after — writing the two baseline files,
retiring the old migration dirs, the count assertions — is the **coding session's**, once KC
hands over the dump output.

---

## Step 3 (KC) — the schema dump

Two corrections to the D-085 phrasing, both from the current Supabase CLI reference:

1. **There is no `--schema-only` flag.** Schema-only is the DEFAULT: *"The default dump does not
   contain any data or custom roles."* Satisfy "schema only, no prod data" by simply **not passing
   `--data-only`**. Do not invent a `--schema-only` flag — the command rejects it.
2. **🔴 The dump EXCLUDES the `storage` and `auth` schemas by design** — *"Runs pg_dump … to
   exclude Supabase managed schemas. The ignored schemas include auth, storage, and those created
   by extensions."* This is the single most likely SILENT failure in the whole task: you dump,
   restore, everything looks fine, and **all 3 buckets + all 10 storage policies are missing**, so
   the suite fails on attachments in a way that looks like a code bug. Step 4 is the other half.

```bash
# If `supabase link --project-ref dhnggnxwjgqvghbxelvw` is already done, db dump defaults to
# --linked and you likely need no --db-url at all:
supabase db dump -f supabase/migrations/00000000000001_baseline_2026_08_04.sql
# else, with the prod connection string (password in the terminal ONLY):
#   supabase db dump --db-url "postgresql://…@…:5432/postgres" -f supabase/migrations/00000000000001_baseline_2026_08_04.sql
```

### Step 3b — prove the dump before trusting it

`private` is NOT a managed schema, so it should come through — but prove it. Run against the dump:

```bash
grep -c "CREATE SCHEMA private"        supabase/migrations/00000000000001_baseline_2026_08_04.sql   # expect 1
grep -c "private.can_write_content"    supabase/migrations/00000000000001_baseline_2026_08_04.sql   # expect >0
grep -c "SECURITY DEFINER"             supabase/migrations/00000000000001_baseline_2026_08_04.sql   # expect >=7
grep -ci "insert into storage.buckets" supabase/migrations/00000000000001_baseline_2026_08_04.sql   # expect 0 — confirms storage was excluded
```

If `private` is missing, every RLS policy in the baseline references a function that doesn't exist
and the restore fails **loudly** — the good outcome. Storage missing fails **silently** — that's
what Step 4 exists to prevent.

---

## Step 4 (coding session, at baseline time) — the storage half + retirement + restore prep

### 4a — the storage-half file, verified byte-exact against prod 2026-08-04

Commit this as `supabase/migrations/00000000000002_baseline_storage_2026_08_04.sql`, applied
**immediately after** `00000000000001`. It creates the 3 buckets + all 10 storage policies the
dump drops. It references `private.can_write_avatar` / `private.is_thread_participant`, which
**only exist after `00000000000001`** (they are why this must NOT be committed as a lone,
out-of-order migration before the schema dump lands — see the ⚠ note at the end of 4a).

```sql
-- Storage baseline, captured from prod dhnggnxwjgqvghbxelvw on 2026-08-04 (verified via
-- execute_sql: 3 buckets + 10 policies, byte-exact). supabase db dump EXCLUDES the storage
-- schema, so this file is the other half of the baseline. Apply it immediately after
-- 00000000000001_baseline_2026_08_04.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars','avatars', true, 2097152,
   array['image/jpeg','image/png','image/webp']),
  ('post-media','post-media', false, 52428800,
   array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']),
  ('message-attachments','message-attachments', false, 52428800,
   array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm',
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'text/csv','text/plain'])
on conflict (id) do nothing;

-- avatars (4)
create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and private.can_write_avatar(name));
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and private.can_write_avatar(name));
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and private.can_write_avatar(name))
  with check (bucket_id = 'avatars' and private.can_write_avatar(name));
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and private.can_write_avatar(name));

-- post-media (3)
create policy "post_media_read" on storage.objects for select to authenticated
  using (bucket_id = 'post-media');
create policy "post_media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (auth.uid())::text);
create policy "post_media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (auth.uid())::text);

-- message-attachments (3)
create policy "message_attach_select" on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments'
         and private.is_thread_participant((nullif((storage.foldername(name))[1],''))::uuid));
create policy "message_attach_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments'
              and (storage.foldername(name))[2] = (auth.uid())::text
              and private.is_thread_participant((nullif((storage.foldername(name))[1],''))::uuid));
create policy "message_attach_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'message-attachments'
         and (storage.foldername(name))[2] = (auth.uid())::text);
```

**Preserved deliberately — do NOT "improve" while transcribing** (matching prod is the entire
point; the initplan cleanup is a separate task, on prod first): the bare `auth.uid()` in the
post-media / message-attachment predicates, and the asymmetry that `message_attach_delete` checks
only the uploader (`[2]`) while `message_attach_select` checks thread participation.

> ⚠ **Why this is NOT committed as a standalone migration ahead of the dump** (deviation from the
> D-085 "commit as a second file" note, with reasoning): (1) it references `private.*` functions
> that the *current* `supabase/migrations/` tree never creates (they live in `docs/BL-*.sql`), so
> an orphaned `00000000000002` cannot apply cleanly in today's tree; (2) it re-creates
> `avatars_select_own`, which the live provenance file
> `supabase/migrations/20260804043523_avatars_scoped_select_own.sql` (D-084) also creates —
> applying both to one DB raises "policy already exists". Both problems dissolve only when file 1
> lands and the old migrations are retired (4c). So file 1 + file 2 + the retirement land
> **together, atomically**. The exact content is preserved here so it is a copy-paste at that
> point — nothing is lost by not committing an un-appliable half now.

### 4b — 🔴 the privilege trap — run on the E2E project BEFORE restoring

From the CLI reference: a restore to a NEW project inherits ALL privileges from the target's
DEFAULT privileges. Skip this and the E2E DB ends up **more permissive than prod** — blanket
grants sitting under the RLS — so tests PASS that should FAIL, the worst failure mode for the one
environment whose job is to tell you whether RLS works.

```sql
alter default privileges in schema public revoke all on tables from anon, authenticated;
```

### 4c — retire the old migration conventions (one convention survives: `supabase/migrations/`)

When the baseline lands, move to `supabase/migrations_archive/` (with a one-line header pointing
at the baseline), so a fresh restore applies ONLY `00000000000001` + `00000000000002`:

- **every** current `supabase/migrations/*.sql` — including `00000000000000_baseline.sql` (the old,
  incomplete baseline) **and** `20260804043523_avatars_scoped_select_own.sql` (the D-084
  provenance file). Retiring the latter is what prevents the `avatars_select_own` double-create in
  4a.
- the 8 `docs/BL-*.sql` migration files (they remain the self-documenting canonical sources; the
  baseline is now the applyable source of truth).

**The rule for the sweep: every `.sql` file dated on or before the baseline goes — NO exceptions
for recency.** `20260804043523_avatars_scoped_select_own.sql` is the newest and feels current, so
it will read as "don't archive this one" — archive it, or `avatars_select_own` is created twice
(once by `00000000000002`, once by it). **End state:** `supabase/migrations/` holds ONLY
`00000000000001_baseline_2026_08_04.sql`, `00000000000002_baseline_storage_2026_08_04.sql`, and
`BASELINE_FINGERPRINT.md` (a reference doc, never applied) — nothing else.

### 4d — restore order

`00000000000001` (schema, incl. `private` + all public objects) → `00000000000002` (buckets +
storage RLS). Then assert extensions exist on the E2E project — a fresh project usually has them,
but assert (verified on prod 2026-08-04):

```sql
select extname, extversion from pg_extension order by 1;
--  load-bearing: pgcrypto 1.3, uuid-ossp 1.1 (schema `extensions`).
--  also present on prod: pg_stat_statements 1.11 (extensions), supabase_vault 0.3.1 (schema `vault`), plpgsql 1.0.
-- If pgcrypto / uuid-ossp are missing: create extension if not exists "<name>" with schema extensions;
```

---

## Step 5 — verification after restore (two layers; the counts are the weak one)

**Layer 1 — the counts below (fast sanity gate).** Independently re-verified against prod
2026-08-04; assert each SEPARATELY (a single "105" lets a 10-policy miss hide in a rounding
argument). But counts are WEAK: all seven pass even if `posts_select` restored as `using
(false)`, a `with check` was dropped, a generated column came back plain, or a `security definer`
came back `invoker`.

**Layer 2 — the definition fingerprint (authoritative): `supabase/migrations/BASELINE_FINGERPRINT.md`.**
Nine md5 hashes over the PARSED definitions of buckets / columns / constraints / enums /
functions / indexes / policies / rls_flags / triggers. Run its query on `sangamline-e2e`; **nine
matches = the schema is the same schema.** Counts can pass on a wrong schema; the fingerprint
cannot. Run both, trust the fingerprint.

| target | value | query |
|---|---|---|
| public tables | **35** | `select count(*) from pg_tables where schemaname='public';` |
| policies `schemaname='public'` | **95** | `select count(*) from pg_policies where schemaname='public';` |
| policies `schemaname='storage'` | **10** | `select count(*) from pg_policies where schemaname='storage';` |
| functions in `private` | **7** | `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private';` |
| functions in `public` | **23** | `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';` |
| non-internal triggers on `public` | **15** | `select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal;` |
| `storage.buckets` rows | **3** | `select count(*) from storage.buckets;` |

Also confirm the generated columns survive on `profiles` (`verification_status`, `verified_at`,
`bridge` — a dump normally carries `GENERATED ALWAYS` but verify, since the seed depends on it).

---

## Step 6 — seed, secrets, THREAD_AB, merge, prove

1. `SUPABASE_URL=<e2e> SUPABASE_SERVICE_ROLE_KEY=<e2e> node scripts/seed-e2e.mjs` — 3 **verified**
   accounts (via the base `us_verification` column — never the generated `verification_status`,
   428C9), the A↔B thread, the B↔C foreign attachment. Prints every value below.
2. GitHub secrets: `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`; update `E2E_EMAIL`,
   `E2E_PASSWORD`, `E2E_FOREIGN_ATTACHMENT_PATH` to the seed output.
3. Paste the printed `THREAD_AB` into `e2e/constants.ts` (the ONE code change).
4. **Merge `bl-e2e-split-01` last.**
5. **Zero-delta proof (the only thing that closes the blocker):** snapshot prod counts
   (`posts / post_comments / post_reactions / post_reposts / post_bookmarks / messages /
   storage.objects`) BEFORE and AFTER a full CI E2E run — IDENTICAL = done; any delta means a path
   still points at prod. Confirm the suite PASSES (not skips — the D-063 failure mode).

---

## Recorded non-finding — `post_media_read` is NOT the avatars enumeration bug

`post_media_read` grants SELECT on **every** post-media object to any authenticated user, which
looks like the same class as the D-084 avatars-enumeration finding. It is NOT: `posts_select` on
the posts table is `using (true)` for authenticated, so post media is exactly as visible as the
posts it belongs to — consistent, not leaky. **No action.** (Contrast `avatars`, where the broad
policy WAS wrong because profile visibility is gated by `private.can_view_profile`, D-025.)
Recorded so nobody re-opens it.
