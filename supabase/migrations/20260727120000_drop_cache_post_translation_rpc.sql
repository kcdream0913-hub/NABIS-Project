-- P0 (Batch M-FIX §1) — remove the content-injection RPC.
--
-- cache_post_translation was SECURITY DEFINER with EXECUTE granted to
-- `authenticated`, and wrote a CALLER-SUPPLIED translation onto ANY post where
-- body_translated is null (first-writer-wins, no ownership check, no length cap).
-- Any signed-in account could therefore define the translation that every
-- other-language viewer sees, on every currently-uncached post.
--
-- Translation caching now happens ENTIRELY server-side in /api/posts/translate:
-- the route computes the translation from the post's OWN body (Anthropic) and
-- persists it with the service role, behind a length cap + target-language check.
-- Nothing attacker-controlled is ever persisted, so this client-callable RPC is
-- removed outright.
--
-- SEQUENCING: apply ONLY AFTER the app change (route no longer calls this RPC)
-- has shipped. Client-first is the intended order; restriction-first would only
-- degrade (the old route's best-effort rpc() call fails silently), not hard-break.
--
-- NOTE: intentionally forward-only — a rollback would reintroduce the vulnerable
-- authenticated grant. If the write path must ever move back into the DB, recreate
-- the function and GRANT EXECUTE to `service_role` only, never `authenticated`.

revoke execute on function public.cache_post_translation(uuid, text, text) from authenticated, anon, public;
drop function if exists public.cache_post_translation(uuid, text, text);
