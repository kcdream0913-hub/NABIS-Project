


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."can_access_message"("p_message_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message_id
      and (
        (m.thread_id is not null and private.is_thread_participant(m.thread_id))
        or (m.channel_id is not null and exists (
          select 1 from public.channel_memberships cm
          where cm.channel_id = m.channel_id and cm.user_id = auth.uid()))
      )
  );
$$;


ALTER FUNCTION "private"."can_access_message"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_view_profile"("target" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target = auth.uid()
    or exists (select 1 from admin_users a where a.user_id = auth.uid())
    or coalesce((select p.preferences->>'visibility' from profiles p where p.id = target), 'public') = 'public'
    or (
      coalesce((select p.preferences->>'visibility' from profiles p where p.id = target), 'public') = 'bridge'
      and coalesce((select p.verification_status from profiles p where p.id = auth.uid()), 'unverified') = 'verified'
    )
    or exists (
      select 1 from direct_thread_participants a
      join direct_thread_participants b on b.thread_id = a.thread_id
      where a.user_id = auth.uid() and b.user_id = target
    )
    or exists (
      select 1 from business_members m1
      join business_members m2 on m2.business_id = m1.business_id
      where m1.user_id = auth.uid() and m2.user_id = target
    )
    or exists (
      select 1 from businesses bz
      join business_members bm on bm.business_id = bz.id
      where (bz.owner_user_id = auth.uid() and bm.user_id = target)
         or (bz.owner_user_id = target and bm.user_id = auth.uid())
    );
$$;


ALTER FUNCTION "private"."can_view_profile"("target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_write_avatar"("object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case (storage.foldername(object_name))[1]
    when 'user' then (storage.foldername(object_name))[2] = (select auth.uid())::text
    when 'business' then exists (select 1 from businesses b where b.id = nullif((storage.foldername(object_name))[2], '')::uuid and b.owner_user_id = (select auth.uid()))
    else false
  end;
$$;


ALTER FUNCTION "private"."can_write_avatar"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_write_content"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select p.verification_status from profiles p where p.id = (select auth.uid())),'unverified') = 'verified' or private.is_admin();
$$;


ALTER FUNCTION "private"."can_write_content"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $$;


ALTER FUNCTION "private"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_thread_participant"("p_thread" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select exists (select 1 from public.direct_thread_participants where thread_id = p_thread and user_id = auth.uid()); $$;


ALTER FUNCTION "private"."is_thread_participant"("p_thread" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_trusted_writer"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$ select auth.uid() is null or private.is_admin(); $$;


ALTER FUNCTION "private"."is_trusted_writer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_account"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'use delete_own_account to delete your own account';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_delete_account"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_message_for_everyone"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  declare m public.messages;
  begin
    select * into m from public.messages where id = p_id;
    if not found then raise exception 'message not found'; end if;
    if m.sender_id <> auth.uid() then raise exception 'not your message'; end if;
    if m.deleted_at is not null then return; end if;
    if m.created_at < now() - interval '1 hour' then raise exception 'delete window elapsed'; end if;
    update public.messages
      set body = null, body_iv = null, attachments = '[]'::jsonb, edited_at = null, deleted_at = now()
      where id = p_id;
    delete from public.message_reactions where message_id = p_id;
  end;
$$;


ALTER FUNCTION "public"."delete_message_for_everyone"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_own_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."delete_own_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_message"("p_id" "uuid", "p_body" "text", "p_body_iv" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  declare m public.messages;
  begin
    select * into m from public.messages where id = p_id;
    if not found then raise exception 'message not found'; end if;
    if m.sender_id <> auth.uid() then raise exception 'not your message'; end if;
    if m.deleted_at is not null then raise exception 'message is deleted'; end if;
    if m.created_at < now() - interval '15 minutes' then raise exception 'edit window elapsed'; end if;
    if char_length(coalesce(btrim(p_body), '')) = 0 then raise exception 'empty body'; end if;

    if m.schema_version = 1 then
      if p_body_iv is null or char_length(btrim(p_body_iv)) = 0 then
        raise exception 'encrypted edit requires body_iv';
      end if;
      if m.body_iv is not null and p_body_iv = m.body_iv then
        raise exception 'iv reuse forbidden';
      end if;
      update public.messages
        set body = p_body, body_iv = p_body_iv, edited_at = now()
        where id = p_id;
    else
      if p_body_iv is not null then
        raise exception 'plaintext edit must not supply body_iv';
      end if;
      update public.messages
        set body = p_body, edited_at = now()
        where id = p_id;
    end if;
  end;
$$;


ALTER FUNCTION "public"."edit_message"("p_id" "uuid", "p_body" "text", "p_body_iv" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_comment_depth"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare p public.post_comments;
begin
  if new.parent_comment_id is null then return new; end if;
  select * into p from public.post_comments where id = new.parent_comment_id;
  if not found then raise exception 'parent comment not found'; end if;
  if p.parent_comment_id is not null then
    raise exception 'replies are limited to one level';
  end if;
  if p.post_id <> new.post_id then
    raise exception 'reply must belong to the same post';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_comment_depth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_reply_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  declare r public.messages;
  begin
    if new.reply_to_message_id is not null then
      select * into r from public.messages where id = new.reply_to_message_id;
      if not found then
        new.reply_to_message_id := null;
      elsif new.thread_id is distinct from r.thread_id
         or new.channel_id is distinct from r.channel_id then
        raise exception 'reply target belongs to a different conversation';
      end if;
    end if;
    return new;
  end;
$$;


ALTER FUNCTION "public"."enforce_reply_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_repost_view"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare src_view text;
begin
  select p.view into src_view from public.posts p where p.id = new.post_id;
  if src_view is null then raise exception 'post not found'; end if;
  if new.view <> src_view and new.view <> 'bridge' then
    raise exception 'a % post may only be reposted into % or bridge', src_view, src_view;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_repost_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_user_id_by_email"("lookup_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  found_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into found_id from auth.users where lower(email) = lower(lookup_email) limit 1;
  return found_id;
end;
$$;


ALTER FUNCTION "public"."find_user_id_by_email"("lookup_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_user_id_by_email"("lookup_email" "text") IS 'CLOSED F8 (CISO 2026-07-22). Email->uid oracle. EXECUTE = service_role only; anon + authenticated denied. Do NOT grant to anon/authenticated; if a server needs it, call with the service key.';



CREATE OR REPLACE FUNCTION "public"."get_or_create_direct_thread"("other_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  existing_thread_id uuid;
  new_thread_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if auth.uid() = other_user_id then
    raise exception 'Cannot start a thread with yourself';
  end if;

  select p1.thread_id into existing_thread_id
  from public.direct_thread_participants p1
  join public.direct_thread_participants p2 on p1.thread_id = p2.thread_id
  where p1.user_id = auth.uid() and p2.user_id = other_user_id
  limit 1;

  if existing_thread_id is not null then
    return existing_thread_id;
  end if;

  insert into public.direct_threads default values returning id into new_thread_id;
  insert into public.direct_thread_participants (thread_id, user_id) values
    (new_thread_id, auth.uid()),
    (new_thread_id, other_user_id);

  return new_thread_id;
end;
$$;


ALTER FUNCTION "public"."get_or_create_direct_thread"("other_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_or_create_direct_thread"("other_user_id" "uuid") IS 'KEEP-BUT-SCOPE (CISO 2026-07-22, D-009). Intended DM-start RPC. SECURITY DEFINER + authenticated-only by design; advisor lint 0029 is permanent-by-design. In-body scope: rejects null auth.uid(); forbids self-thread; target FK-bound to profiles; returns existing thread if present. Outstanding product-layer control: per-user rate limit + block-list (Task 1.2). Do NOT revoke without replacing the DM-start path.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  raw_country text := lower(nullif(meta->>'country', ''));
  norm_country text := case when raw_country in ('us', 'nepal') then raw_country else null end;
  incoming_sectors text[] := case
    when jsonb_typeof(meta->'sectors') = 'array'
      then array(select jsonb_array_elements_text(meta->'sectors'))
    else '{}'::text[]
  end;
  valid_sectors text[];
  consent jsonb := meta->'consent';
  granted timestamptz := coalesce(nullif(consent->>'at', '')::timestamptz, now());
  loc text := consent->>'locale';
begin
  select coalesce(array_agg(distinct s order by s), '{}'::text[])
    into valid_sectors
    from unnest(incoming_sectors) as s
    where s in (select slug from public.channels);

  insert into public.profiles (id, name, avatar_url, oauth_provider, country, sectors)
  values (
    new.id,
    coalesce(meta->>'name', meta->>'full_name', new.email),
    meta->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    norm_country,
    valid_sectors
  )
  on conflict (id) do nothing;

  if consent ? 'tos' then
    insert into public.consents (user_id, doc_type, doc_version, granted_at, locale)
    values (new.id, 'tos', regexp_replace(consent->>'tos', '^tos_', ''), granted, loc);
  end if;
  if consent ? 'privacy' then
    insert into public.consents (user_id, doc_type, doc_version, granted_at, locale)
    values (new.id, 'privacy', regexp_replace(consent->>'privacy', '^privacy_', ''), granted, loc);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_post_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_author uuid; v_view text; v_parent_author uuid;
begin
  select p.author_id, p.view into v_author, v_view
    from public.posts p where p.id = new.post_id;

  if new.parent_comment_id is not null then
    select c.author_id into v_parent_author
      from public.post_comments c where c.id = new.parent_comment_id;
    if v_parent_author is not null and v_parent_author <> new.author_id then
      insert into public.notifications
        (recipient_id, actor_id, type, post_id, comment_id, view)
      values (v_parent_author, new.author_id, 'comment_reply',
              new.post_id, new.id, v_view);
    end if;
  end if;

  if v_author is not null
     and v_author <> new.author_id
     and (v_parent_author is null or v_parent_author <> v_author) then
    insert into public.notifications
      (recipient_id, actor_id, type, post_id, comment_id, view)
    values (v_author, new.author_id, 'post_comment',
            new.post_id, new.id, v_view);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_post_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_post_reaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_author uuid; v_view text;
begin
  select p.author_id, p.view into v_author, v_view
    from public.posts p where p.id = new.post_id;
  if v_author is null or v_author = new.user_id then return new; end if;
  insert into public.notifications
    (recipient_id, actor_id, type, post_id, view)
  values (v_author, new.user_id, 'post_reaction', new.post_id, v_view)
  on conflict do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_post_reaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_post_repost"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_author uuid; v_view text;
begin
  select p.author_id, p.view into v_author, v_view from public.posts p where p.id = new.post_id;
  if v_author is null or v_author = new.user_id then return new; end if;
  insert into public.notifications
    (recipient_id, actor_id, type, post_id, view)
  values (v_author, new.user_id, 'post_repost', new.post_id, v_view)
  on conflict do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_post_repost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_business_trust_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.verification_status:='unverified'; new.verified_at:=null; new.is_paid_provider:=false;
  else new.verification_status:=old.verification_status; new.verified_at:=old.verified_at; new.is_paid_provider:=old.is_paid_provider; end if; return new; end $$;


ALTER FUNCTION "public"."protect_business_trust_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_dtp_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.thread_id := old.thread_id;
  new.user_id   := old.user_id;
  return new;
end $$;


ALTER FUNCTION "public"."protect_dtp_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_feedback_intake"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.created_at := now();
  new.status     := 'new';
  return new;
end $$;


ALTER FUNCTION "public"."protect_feedback_intake"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_notification_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.recipient_id is distinct from old.recipient_id
     or new.actor_id   is distinct from old.actor_id
     or new.type       is distinct from old.type
     or new.post_id    is distinct from old.post_id
     or new.comment_id is distinct from old.comment_id
     or new.view       is distinct from old.view
     or new.created_at is distinct from old.created_at then
    raise exception 'only read_at may be updated';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_notification_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_post_body_edits"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.body is distinct from old.body and not private.can_write_content() then
    raise exception 'only verified members may edit content' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_post_body_edits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_post_comment_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.post_id <> old.post_id or new.author_id <> old.author_id or new.created_at <> old.created_at or new.parent_comment_id is distinct from old.parent_comment_id then
    raise exception 'immutable column on post_comments';
  end if;
  if old.deleted_at is not null then raise exception 'comment is deleted'; end if;
  if auth.uid() is distinct from old.author_id then
    if new.body is distinct from old.body or new.deleted_at is null then
      raise exception 'only the comment author may edit; others may only remove';
    end if;
  end if;
  if new.deleted_at is not null then new.body := null; new.edited_at := old.edited_at; return new; end if;
  if new.body is distinct from old.body then
    if not private.can_write_content() then raise exception 'only verified members may edit content' using errcode = '42501'; end if;
    if old.created_at < now() - interval '15 minutes' then raise exception 'edit window elapsed'; end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_post_comment_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_trust_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if private.is_trusted_writer() then return new; end if;
  if tg_op = 'INSERT' then
    new.us_verification := 'none';
    new.np_verification := 'none';
    new.us_verified_at  := null;
    new.np_verified_at  := null;
    new.special_badge   := null;
  else
    new.us_verification := old.us_verification;
    new.np_verification := old.np_verification;
    new.us_verified_at  := old.us_verified_at;
    new.np_verified_at  := old.np_verified_at;
    new.special_badge   := old.special_badge;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."protect_profile_trust_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_rd_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.status:='submitted'; new.reviewer_notes:=null;
  else new.status:=old.status; new.reviewer_notes:=old.reviewer_notes; end if; return new; end $$;


ALTER FUNCTION "public"."protect_rd_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_report_intake"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.status      := 'open';
  new.reviewer_id := null;
  new.created_at  := now();
  return new;
end $$;


ALTER FUNCTION "public"."protect_report_intake"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_verification_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.status:='pending'; new.reviewer_id:=null;
  else new.status:=old.status; new.reviewer_id:=old.reviewer_id; end if; return new; end $$;


ALTER FUNCTION "public"."protect_verification_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_business_invite"("invite_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  inv record;
  caller_email text;
begin
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    return false;
  end if;

  select * into inv from public.invites
  where id = invite_id
    and type = 'business_member'
    and status = 'pending'
    and lower(target) = lower(caller_email)
    and (expires_at is null or expires_at > now());

  if not found then
    return false;
  end if;

  insert into public.business_members (business_id, user_id, role, status, can_post, verified_via, added_by)
  values (inv.business_id, auth.uid(), coalesce(inv.role, 'employee'), 'active', inv.can_post, 'business', inv.from_user_id)
  on conflict (business_id, user_id) do nothing;

  update public.invites set status = 'accepted', used_at = now() where id = inv.id;
  return true;
end;
$$;


ALTER FUNCTION "public"."redeem_business_invite"("invite_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."redeem_business_invite"("invite_id" "uuid") IS 'KEEP-BUT-SCOPE (CISO 2026-07-22, D-009). Intended invite-redeem RPC. SECURITY DEFINER + authenticated-only by design; advisor lint 0029 is permanent-by-design. In-body scope: binds to caller email; requires pending + non-expired + owner-minted invite; idempotent membership insert. Do NOT revoke without replacing the invite-redeem path.';



CREATE OR REPLACE FUNCTION "public"."validate_post_media"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  item jsonb;
  t    text;
  imgs int := 0;
  vids int := 0;
begin
  if new.media is null then new.media := '[]'::jsonb; end if;
  if jsonb_typeof(new.media) <> 'array' then
    raise exception 'media must be a json array';
  end if;
  if jsonb_array_length(new.media) > 4 then
    raise exception 'at most 4 media items per post';
  end if;

  for item in select value from jsonb_array_elements(new.media) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'media item must be an object';
    end if;

    t := item->>'type';
    if t is null or t not in ('image','video') then
      raise exception 'media type must be image or video (got %)', coalesce(t,'null');
    end if;

    if coalesce(item->>'path','') = '' then
      raise exception 'media item requires path';
    end if;
    if item->>'path' like '%..%' then
      raise exception 'invalid media path';
    end if;
    if coalesce(item->>'mime','') = '' then
      raise exception 'media item requires mime';
    end if;
    if coalesce((item->>'bytes')::bigint, 0) <= 0 then
      raise exception 'media item requires bytes';
    end if;

    if t = 'image' then
      if item->>'mime' not in ('image/jpeg','image/png','image/webp','image/gif') then
        raise exception 'unsupported image mime %', item->>'mime';
      end if;
      if (item->>'bytes')::bigint > 10485760 then
        raise exception 'image exceeds 10MB';
      end if;
      imgs := imgs + 1;
    else
      if item->>'mime' not in ('video/mp4','video/webm','video/quicktime') then
        raise exception 'unsupported video mime %', item->>'mime';
      end if;
      if (item->>'bytes')::bigint > 52428800 then
        raise exception 'video exceeds 50MB';
      end if;
      if coalesce((item->>'duration_ms')::int, 0) <= 0
         or (item->>'duration_ms')::int > 90000 then
        raise exception 'video duration must be between 0 and 90 seconds';
      end if;
      if coalesce(item->>'poster_path','') = '' then
        raise exception 'video requires poster_path';
      end if;
      vids := vids + 1;
    end if;
  end loop;

  if vids > 1 then
    raise exception 'at most one video per post';
  end if;
  if vids > 0 and imgs > 0 then
    raise exception 'a post may contain up to 4 images or one video, not both';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_post_media"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."access_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_user_id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "platform_fee" numeric(12,2),
    "provider_payout" numeric(12,2),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "access_purchases_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['business'::"text", 'user'::"text"]))),
    CONSTRAINT "access_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."access_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "source" "text" DEFAULT 'homepage'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "access_requests_email_check" CHECK ((("email" ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::"text") AND ("length"("email") <= 320))),
    CONSTRAINT "access_requests_note_check" CHECK (("length"("note") <= 2000))
);


ALTER TABLE "public"."access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "can_post" boolean DEFAULT false NOT NULL,
    "verified_via" "text" DEFAULT 'business'::"text" NOT NULL,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'professional'::"text", 'assistant'::"text", 'employee'::"text"]))),
    CONSTRAINT "business_members_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'active'::"text"]))),
    CONSTRAINT "business_members_verified_via_check" CHECK (("verified_via" = ANY (ARRAY['self'::"text", 'business'::"text"])))
);


ALTER TABLE "public"."business_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "bio" "text",
    "country_of_registration" "text",
    "primary_sector" "text" NOT NULL,
    "registration_number" "text",
    "verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "owner_user_id" "uuid" NOT NULL,
    "is_paid_provider" boolean DEFAULT false NOT NULL,
    "access_price_amount" numeric(12,2),
    "access_price_currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "payout_account_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_email" "text",
    "credentials" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "social_links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "secondary_sectors" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "bio_ne" "text",
    "bio_ne_auto" boolean DEFAULT false NOT NULL,
    "website_url" "text",
    "phone" "text",
    "address_line" "text",
    "city" "text",
    "google_place_id" "text",
    "google_maps_url" "text",
    "import_source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "imported_at" timestamp with time zone,
    "field_sources" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "verification_requested" boolean DEFAULT false NOT NULL,
    "verification_requested_at" timestamp with time zone,
    "profile_answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "businesses_import_source_check" CHECK (("import_source" = ANY (ARRAY['manual'::"text", 'google_place'::"text", 'google_url'::"text", 'proxy'::"text", 'website'::"text", 'guided'::"text", 'facebook_page'::"text"]))),
    CONSTRAINT "businesses_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['unverified'::"text", 'verified'::"text"]))),
    CONSTRAINT "secondary_not_primary" CHECK ((NOT ("primary_sector" = ANY ("secondary_sectors")))),
    CONSTRAINT "secondary_sectors_max_4" CHECK ((("array_length"("secondary_sectors", 1) IS NULL) OR ("array_length"("secondary_sectors", 1) <= 4)))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."businesses"."credentials" IS 'Sector-specific credential fields (license numbers, registrations) keyed by field id from lib/sectorFields.ts. Self-declared until checked by verification job.';



COMMENT ON COLUMN "public"."businesses"."social_links" IS 'Imported/linked social presence: {facebook, instagram, tiktok, website} URLs plus optional import metadata.';



COMMENT ON COLUMN "public"."businesses"."google_place_id" IS 'Google Place ID. Storable indefinitely per Maps Platform Google ID caching exemption. Presence does NOT imply verified ownership of the listing.';



COMMENT ON COLUMN "public"."businesses"."import_source" IS 'How the profile was first populated. manual|google_place|google_url|proxy|website|guided|facebook_page. UX metadata only; NOT a trust signal.';



COMMENT ON COLUMN "public"."businesses"."field_sources" IS 'Form-UX provenance only: {"name":"google"|"user", ...}. NEVER render as a public trust signal - it is client-supplied and unverified. Public trust comes from verification_status only.';



COMMENT ON COLUMN "public"."businesses"."verification_requested" IS 'Owner asked to be reviewed for Verified Business. Admin flips verification_status; owners cannot.';



COMMENT ON COLUMN "public"."businesses"."profile_answers" IS 'BL-BIZ-02 guided onboarding answers (sector, services[], customers[], years, differentiator, crossborder). Deterministic input to the EN+NE bio assembler. Owner-supplied; NOT a trust signal.';



CREATE TABLE IF NOT EXISTS "public"."channel_memberships" (
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone
);


ALTER TABLE "public"."channel_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sector" "text",
    "owner_user_id" "uuid",
    "has_group_discussion" boolean DEFAULT false NOT NULL,
    "min_tier" "text",
    "is_private" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "doc_version" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip" "text",
    "locale" "text"
);


ALTER TABLE "public"."consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direct_thread_participants" (
    "thread_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone
);


ALTER TABLE "public"."direct_thread_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direct_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."direct_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "date" "date",
    "time" "text",
    "mode" "text",
    "location" "text",
    "view" "text",
    "description" "text",
    "host_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "event_tz" "text",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "host_business_id" "uuid",
    CONSTRAINT "events_mode_check" CHECK (("mode" = ANY (ARRAY['in_person'::"text", 'online'::"text"]))),
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'cancelled'::"text", 'postponed'::"text"]))),
    CONSTRAINT "events_view_check" CHECK (("view" = ANY (ARRAY['us'::"text", 'nepal'::"text", 'bridge'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."starts_at" IS 'Absolute start instant (UTC). Render in event_tz or viewer tz. Replaces ambiguous date+time text.';



COMMENT ON COLUMN "public"."events"."ends_at" IS 'Absolute end instant (UTC), optional.';



COMMENT ON COLUMN "public"."events"."event_tz" IS 'IANA timezone the event is scheduled in (display + DST), e.g. America/New_York, Asia/Kathmandu.';



CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "kind" "text" NOT NULL,
    "body" "text" NOT NULL,
    "page_path" "text",
    "locale" "text",
    "user_agent" "text",
    "app_version" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_app_version_check" CHECK (("char_length"("app_version") <= 64)),
    CONSTRAINT "feedback_body_check" CHECK ((("char_length"("btrim"("body")) >= 10) AND ("char_length"("btrim"("body")) <= 4000))),
    CONSTRAINT "feedback_kind_check" CHECK (("kind" = ANY (ARRAY['bug'::"text", 'idea'::"text", 'confusing'::"text", 'other'::"text"]))),
    CONSTRAINT "feedback_locale_check" CHECK (("char_length"("locale") <= 32)),
    CONSTRAINT "feedback_page_path_check" CHECK (("char_length"("page_path") <= 512)),
    CONSTRAINT "feedback_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'triaged'::"text", 'closed'::"text"]))),
    CONSTRAINT "feedback_user_agent_check" CHECK (("char_length"("user_agent") <= 1024))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festivals" (
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "name_ne" "text",
    "country" "text",
    "month_hint" "text",
    "dates" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "festivals_country_check" CHECK (("country" = ANY (ARRAY['np'::"text", 'us'::"text"])))
);


ALTER TABLE "public"."festivals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "from_user_id" "uuid",
    "target" "text",
    "business_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text",
    "can_post" boolean DEFAULT false NOT NULL,
    CONSTRAINT "invites_role_check" CHECK (("role" = ANY (ARRAY['professional'::"text", 'assistant'::"text", 'employee'::"text"]))),
    CONSTRAINT "invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text"]))),
    CONSTRAINT "invites_type_check" CHECK (("type" = ANY (ARRAY['business_member'::"text", 'vouch'::"text"])))
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itineraries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "view" "text",
    "start_date" "date",
    "end_date" "date",
    "group_size" integer,
    "budget_amount" numeric(12,2),
    "budget_currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "interests" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "direction" "text",
    "origin_country" "text",
    "destination_country" "text",
    CONSTRAINT "itineraries_direction_check" CHECK (("direction" = ANY (ARRAY['np_to_us'::"text", 'us_to_np'::"text", 'domestic_np'::"text", 'domestic_us'::"text", 'other'::"text"]))),
    CONSTRAINT "itineraries_group_size_check" CHECK ((("group_size" IS NULL) OR ("group_size" > 0))),
    CONSTRAINT "itineraries_view_check" CHECK (("view" = ANY (ARRAY['us'::"text", 'nepal'::"text", 'bridge'::"text"])))
);


ALTER TABLE "public"."itineraries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itinerary_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "itinerary_id" "uuid" NOT NULL,
    "day" integer DEFAULT 1 NOT NULL,
    "title" "text" NOT NULL,
    "category" "text",
    "estimated_cost" numeric(12,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_id" "uuid",
    "offering_id" "uuid",
    CONSTRAINT "itinerary_items_category_check" CHECK (("category" = ANY (ARRAY['stay'::"text", 'activity'::"text", 'transport'::"text", 'food'::"text", 'other'::"text"]))),
    CONSTRAINT "itinerary_items_day_check" CHECK (("day" >= 1))
);


ALTER TABLE "public"."itinerary_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."itinerary_items"."business_id" IS 'Optional FK to a directory business when the item is a real provider (vs a free-text plan). Null = free-text item; on delete set null so removing a business never deletes a user''s saved plan.';



CREATE TABLE IF NOT EXISTS "public"."message_hides" (
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."message_hides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reactions" (
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "message_reactions_emoji_check" CHECK ((("char_length"("emoji") >= 1) AND ("char_length"("emoji") <= 32)))
);

ALTER TABLE ONLY "public"."message_reactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."message_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid",
    "thread_id" "uuid",
    "sender_id" "uuid" NOT NULL,
    "body" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reply_to_message_id" "uuid",
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "schema_version" smallint DEFAULT 0 NOT NULL,
    "body_iv" "text",
    CONSTRAINT "messages_check" CHECK ((("channel_id" IS NOT NULL) OR ("thread_id" IS NOT NULL)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "post_id" "uuid",
    "comment_id" "uuid",
    "view" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['post_reaction'::"text", 'post_comment'::"text", 'comment_reply'::"text", 'post_repost'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offerings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "business_id" "uuid",
    "profile_id" "uuid",
    "sector" "text" DEFAULT 'tourism-hospitality'::"text" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "title_ne" "text",
    "description" "text",
    "description_ne" "text",
    "country" "text",
    "region" "text",
    "direction_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "price_from" numeric,
    "price_currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "price_unit" "text" DEFAULT 'per_person'::"text" NOT NULL,
    "duration_days" integer,
    "group_min" integer,
    "group_max" integer,
    "seasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "festival_slugs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "available_from" "date",
    "available_to" "date",
    "media" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "offerings_check" CHECK (((("owner_type" = 'business'::"text") = ("business_id" IS NOT NULL)) AND (("owner_type" = 'profile'::"text") = ("profile_id" IS NOT NULL)))),
    CONSTRAINT "offerings_country_check" CHECK (("country" = ANY (ARRAY['np'::"text", 'us'::"text"]))),
    CONSTRAINT "offerings_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['business'::"text", 'profile'::"text"]))),
    CONSTRAINT "offerings_price_unit_check" CHECK (("price_unit" = ANY (ARRAY['per_person'::"text", 'per_group'::"text", 'per_night'::"text"]))),
    CONSTRAINT "offerings_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"]))),
    CONSTRAINT "offerings_type_check" CHECK (("type" = ANY (ARRAY['trek'::"text", 'tour'::"text", 'stay'::"text", 'food_experience'::"text", 'transport'::"text", 'festival_package'::"text", 'guide_service'::"text", 'wellness'::"text", 'event_package'::"text"])))
);


ALTER TABLE "public"."offerings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_bookmarks" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "parent_comment_id" "uuid",
    "body" "text",
    "body_lang" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "post_comments_body_lang_check" CHECK (("body_lang" = ANY (ARRAY['en'::"text", 'ne'::"text"]))),
    CONSTRAINT "post_comments_body_state" CHECK (((("deleted_at" IS NOT NULL) AND ("body" IS NULL)) OR (("deleted_at" IS NULL) AND ("body" IS NOT NULL) AND (("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 2000)))))
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reactions" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" DEFAULT 'like'::"text" NOT NULL,
    CONSTRAINT "post_reactions_kind_check" CHECK (("kind" = ANY (ARRAY['like'::"text", 'celebrate'::"text", 'support'::"text", 'insightful'::"text", 'namaste'::"text"])))
);


ALTER TABLE "public"."post_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reposts" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quote" "text",
    "quote_lang" "text",
    "view" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_reposts_quote_lang_check" CHECK (("quote_lang" = ANY (ARRAY['en'::"text", 'ne'::"text"]))),
    CONSTRAINT "post_reposts_quote_len" CHECK ((("quote" IS NULL) OR (("char_length"("btrim"("quote")) >= 1) AND ("char_length"("btrim"("quote")) <= 1000)))),
    CONSTRAINT "post_reposts_view_check" CHECK (("view" = ANY (ARRAY['us'::"text", 'nepal'::"text", 'bridge'::"text"])))
);


ALTER TABLE "public"."post_reposts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_shares_channel_check" CHECK (("channel" = ANY (ARRAY['dm'::"text", 'copy_link'::"text", 'native'::"text"])))
);


ALTER TABLE "public"."post_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "posted_as" "text" DEFAULT 'user'::"text" NOT NULL,
    "business_id" "uuid",
    "channel_id" "uuid",
    "body" "text" NOT NULL,
    "view" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "body_lang" "text" DEFAULT 'en'::"text" NOT NULL,
    "body_translated" "text",
    "body_translated_lang" "text",
    "media" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "posts_body_lang_check" CHECK (("body_lang" = ANY (ARRAY['en'::"text", 'ne'::"text"]))),
    CONSTRAINT "posts_body_translated_lang_check" CHECK (("body_translated_lang" = ANY (ARRAY['en'::"text", 'ne'::"text"]))),
    CONSTRAINT "posts_media_shape_check" CHECK ((("jsonb_typeof"("media") = 'array'::"text") AND ("jsonb_array_length"("media") <= 4))),
    CONSTRAINT "posts_posted_as_check" CHECK (("posted_as" = ANY (ARRAY['user'::"text", 'business'::"text"]))),
    CONSTRAINT "posts_view_check" CHECK (("view" = ANY (ARRAY['us'::"text", 'nepal'::"text", 'bridge'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "avatar_url" "text",
    "phone" "text",
    "oauth_provider" "text",
    "sectors" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "country" "text",
    "city" "text",
    "bio" "text",
    "links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "special_badge" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "us_verification" "text" DEFAULT 'none'::"text" NOT NULL,
    "np_verification" "text" DEFAULT 'none'::"text" NOT NULL,
    "us_verified_at" timestamp with time zone,
    "np_verified_at" timestamp with time zone,
    "verification_status" "text" GENERATED ALWAYS AS (
CASE
    WHEN (("us_verification" = 'verified'::"text") OR ("np_verification" = 'verified'::"text")) THEN 'verified'::"text"
    ELSE 'unverified'::"text"
END) STORED,
    "verified_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("us_verified_at", "np_verified_at")) STORED,
    "bridge" boolean GENERATED ALWAYS AS ((("us_verification" = 'verified'::"text") AND ("np_verification" = 'verified'::"text"))) STORED,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "bio_ne" "text",
    "bio_ne_auto" boolean DEFAULT false NOT NULL,
    "headline" "text",
    CONSTRAINT "profiles_country_check" CHECK (("country" = ANY (ARRAY['us'::"text", 'nepal'::"text"]))),
    CONSTRAINT "profiles_headline_check" CHECK (("char_length"("headline") <= 120)),
    CONSTRAINT "profiles_np_verification_check" CHECK (("np_verification" = ANY (ARRAY['none'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text", 'revoked'::"text"]))),
    CONSTRAINT "profiles_oauth_provider_check" CHECK (("oauth_provider" = ANY (ARRAY['google'::"text", 'apple'::"text", 'email'::"text", 'phone'::"text"]))),
    CONSTRAINT "profiles_special_badge_check" CHECK (("special_badge" = 'diplomat'::"text")),
    CONSTRAINT "profiles_us_verification_check" CHECK (("us_verification" = ANY (ARRAY['none'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."us_verification" IS 'US track status. Written only by trusted writers (admin review / service). Pinned by trg_protect_profile_trust.';



COMMENT ON COLUMN "public"."profiles"."np_verification" IS 'Nepal track status. Written only by trusted writers (admin review / service). Pinned by trg_protect_profile_trust.';



COMMENT ON COLUMN "public"."profiles"."verification_status" IS 'LEGACY generated alias (any track verified). Do not gate new features on this; use us/np_verification or bridge.';



COMMENT ON COLUMN "public"."profiles"."bridge" IS 'GENERATED: both tracks verified. Never writable by anyone (BL-TRUST-01 V1e). The only path to Bridge is completing both tracks.';



CREATE TABLE IF NOT EXISTS "public"."rd_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "venture_name" "text" NOT NULL,
    "one_liner" "text" NOT NULL,
    "stage" "text" NOT NULL,
    "team_summary" "text",
    "problem_solution" "text",
    "funding_sought" "text",
    "incorporation_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "us_nepal_relevance" "text",
    "links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "reviewer_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rd_applications_incorporation_status_check" CHECK (("incorporation_status" = ANY (ARRAY['none'::"text", 'nepal_pvt_ltd'::"text", 'us_entity'::"text", 'both'::"text", 'other'::"text"]))),
    CONSTRAINT "rd_applications_stage_check" CHECK (("stage" = ANY (ARRAY['idea'::"text", 'prototype'::"text", 'revenue'::"text", 'scaling'::"text"]))),
    CONSTRAINT "rd_applications_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'screening'::"text", 'accepted'::"text", 'rejected'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."rd_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reporter_id" "uuid",
    "reason" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reviewer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'actioned'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rsvps" (
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread_keys" (
    "thread_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wrapped_key" "text" NOT NULL,
    "wrapped_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."thread_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_key_recovery" (
    "user_id" "uuid" NOT NULL,
    "wrapped_private_key" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_key_recovery" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_keys" (
    "user_id" "uuid" NOT NULL,
    "public_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_keys" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_trust_tiers" WITH ("security_invoker"='true') AS
 SELECT "id",
        CASE
            WHEN "bridge" THEN 'bridge'::"text"
            WHEN (("us_verification" = 'verified'::"text") OR ("np_verification" = 'verified'::"text")) THEN 'verified'::"text"
            ELSE 'basic'::"text"
        END AS "trust_tier",
    "array_remove"(ARRAY[
        CASE
            WHEN ("us_verification" = 'verified'::"text") THEN 'us'::"text"
            ELSE NULL::"text"
        END,
        CASE
            WHEN ("np_verification" = 'verified'::"text") THEN 'nepal'::"text"
            ELSE NULL::"text"
        END], NULL::"text") AS "verified_tracks",
    "bridge"
   FROM "public"."profiles" "p";


ALTER VIEW "public"."user_trust_tiers" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_trust_tiers" IS 'TrustBadge read surface: basic | verified (+which tracks) | bridge. pending/rejected/revoked are private states and never surface here.';



CREATE TABLE IF NOT EXISTS "public"."verification_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject_type" "text" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "provider" "text",
    "document_type" "text",
    "document_country" "text",
    "checks" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "policy_track" "text" NOT NULL,
    CONSTRAINT "verification_records_policy_track_check" CHECK (("policy_track" = ANY (ARRAY['us'::"text", 'nepal'::"text"]))),
    CONSTRAINT "verification_records_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'passed'::"text", 'failed'::"text"]))),
    CONSTRAINT "verification_records_subject_type_check" CHECK (("subject_type" = ANY (ARRAY['user'::"text", 'business'::"text"])))
);


ALTER TABLE "public"."verification_records" OWNER TO "postgres";


ALTER TABLE ONLY "public"."access_purchases"
    ADD CONSTRAINT "access_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_user_id_key" UNIQUE ("business_id", "user_id");



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_memberships"
    ADD CONSTRAINT "channel_memberships_pkey" PRIMARY KEY ("channel_id", "user_id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."direct_thread_participants"
    ADD CONSTRAINT "direct_thread_participants_pkey" PRIMARY KEY ("thread_id", "user_id");



ALTER TABLE ONLY "public"."direct_threads"
    ADD CONSTRAINT "direct_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festivals"
    ADD CONSTRAINT "festivals_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itineraries"
    ADD CONSTRAINT "itineraries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itinerary_items"
    ADD CONSTRAINT "itinerary_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_hides"
    ADD CONSTRAINT "message_hides_pkey" PRIMARY KEY ("message_id", "user_id");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("message_id", "user_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_bookmarks"
    ADD CONSTRAINT "post_bookmarks_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."post_reposts"
    ADD CONSTRAINT "post_reposts_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."post_shares"
    ADD CONSTRAINT "post_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rd_applications"
    ADD CONSTRAINT "rd_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_pkey" PRIMARY KEY ("user_id", "event_id");



ALTER TABLE ONLY "public"."thread_keys"
    ADD CONSTRAINT "thread_keys_pkey" PRIMARY KEY ("thread_id", "user_id");



ALTER TABLE ONLY "public"."user_key_recovery"
    ADD CONSTRAINT "user_key_recovery_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_keys"
    ADD CONSTRAINT "user_keys_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."verification_records"
    ADD CONSTRAINT "verification_records_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "access_requests_email_uidx" ON "public"."access_requests" USING "btree" ("lower"("email"));



CREATE INDEX "business_members_user_id_idx" ON "public"."business_members" USING "btree" ("user_id");



CREATE INDEX "businesses_city_idx" ON "public"."businesses" USING "btree" ("lower"("city")) WHERE ("city" IS NOT NULL);



CREATE UNIQUE INDEX "businesses_google_place_id_key" ON "public"."businesses" USING "btree" ("google_place_id") WHERE ("google_place_id" IS NOT NULL);



CREATE INDEX "businesses_owner_user_id_idx" ON "public"."businesses" USING "btree" ("owner_user_id");



CREATE INDEX "businesses_sector_idx" ON "public"."businesses" USING "btree" ("primary_sector");



CREATE INDEX "consents_user_id_idx" ON "public"."consents" USING "btree" ("user_id");



CREATE INDEX "feedback_status_created_idx" ON "public"."feedback" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "feedback_user_created_idx" ON "public"."feedback" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_message_hides_user" ON "public"."message_hides" USING "btree" ("user_id");



CREATE INDEX "idx_message_reactions_user" ON "public"."message_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_messages_reply_to" ON "public"."messages" USING "btree" ("reply_to_message_id");



CREATE INDEX "idx_thread_keys_user" ON "public"."thread_keys" USING "btree" ("user_id");



CREATE INDEX "idx_thread_keys_wrapped_by" ON "public"."thread_keys" USING "btree" ("wrapped_by");



CREATE INDEX "itineraries_user_id_created_at_idx" ON "public"."itineraries" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "itinerary_items_business_id_idx" ON "public"."itinerary_items" USING "btree" ("business_id");



CREATE INDEX "itinerary_items_itinerary_id_day_sort_order_idx" ON "public"."itinerary_items" USING "btree" ("itinerary_id", "day", "sort_order");



CREATE INDEX "itinerary_items_offering_id_idx" ON "public"."itinerary_items" USING "btree" ("offering_id");



CREATE INDEX "messages_channel_id_created_at_idx" ON "public"."messages" USING "btree" ("channel_id", "created_at");



CREATE INDEX "messages_thread_id_created_at_idx" ON "public"."messages" USING "btree" ("thread_id", "created_at");



CREATE INDEX "notifications_actor_idx" ON "public"."notifications" USING "btree" ("actor_id");



CREATE INDEX "notifications_comment_idx" ON "public"."notifications" USING "btree" ("comment_id");



CREATE UNIQUE INDEX "notifications_dedupe_idx" ON "public"."notifications" USING "btree" ("recipient_id", "actor_id", "type", "post_id") WHERE ("type" = ANY (ARRAY['post_reaction'::"text", 'post_repost'::"text"]));



CREATE INDEX "notifications_post_idx" ON "public"."notifications" USING "btree" ("post_id");



CREATE INDEX "notifications_recipient_idx" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "notifications_recipient_unread_idx" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC) WHERE ("read_at" IS NULL);



CREATE INDEX "offerings_business_id_idx" ON "public"."offerings" USING "btree" ("business_id");



CREATE INDEX "offerings_profile_id_idx" ON "public"."offerings" USING "btree" ("profile_id");



CREATE INDEX "offerings_status_idx" ON "public"."offerings" USING "btree" ("status");



CREATE INDEX "post_bookmarks_user_created_idx" ON "public"."post_bookmarks" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "post_comments_author_idx" ON "public"."post_comments" USING "btree" ("author_id", "created_at" DESC);



CREATE INDEX "post_comments_parent_idx" ON "public"."post_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "post_comments_post_created_idx" ON "public"."post_comments" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "post_reactions_post_id_idx" ON "public"."post_reactions" USING "btree" ("post_id");



CREATE INDEX "post_reposts_user_created_idx" ON "public"."post_reposts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "post_reposts_view_created_idx" ON "public"."post_reposts" USING "btree" ("view", "created_at" DESC);



CREATE INDEX "post_shares_post_created_idx" ON "public"."post_shares" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "posts_created_at_idx" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "profiles_bridge_idx" ON "public"."profiles" USING "btree" ("bridge") WHERE "bridge";



CREATE INDEX "rd_applications_status_idx" ON "public"."rd_applications" USING "btree" ("status");



CREATE INDEX "rd_applications_user_idx" ON "public"."rd_applications" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_enforce_comment_depth" BEFORE INSERT ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_comment_depth"();



CREATE OR REPLACE TRIGGER "trg_enforce_reply_integrity" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_reply_integrity"();



CREATE OR REPLACE TRIGGER "trg_enforce_repost_view" BEFORE INSERT ON "public"."post_reposts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_repost_view"();



CREATE OR REPLACE TRIGGER "trg_notify_post_comment" AFTER INSERT ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_post_comment"();



CREATE OR REPLACE TRIGGER "trg_notify_post_reaction" AFTER INSERT ON "public"."post_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_post_reaction"();



CREATE OR REPLACE TRIGGER "trg_notify_post_repost" AFTER INSERT ON "public"."post_reposts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_post_repost"();



CREATE OR REPLACE TRIGGER "trg_protect_business_trust" BEFORE INSERT OR UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."protect_business_trust_columns"();



CREATE OR REPLACE TRIGGER "trg_protect_dtp_identity" BEFORE UPDATE ON "public"."direct_thread_participants" FOR EACH ROW EXECUTE FUNCTION "public"."protect_dtp_identity"();



CREATE OR REPLACE TRIGGER "trg_protect_feedback_intake" BEFORE INSERT ON "public"."feedback" FOR EACH ROW EXECUTE FUNCTION "public"."protect_feedback_intake"();



CREATE OR REPLACE TRIGGER "trg_protect_notification_columns" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."protect_notification_columns"();



CREATE OR REPLACE TRIGGER "trg_protect_post_body_edits" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."protect_post_body_edits"();



CREATE OR REPLACE TRIGGER "trg_protect_post_comment_columns" BEFORE UPDATE ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."protect_post_comment_columns"();



CREATE OR REPLACE TRIGGER "trg_protect_profile_trust" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_trust_columns"();



CREATE OR REPLACE TRIGGER "trg_protect_rd_status" BEFORE INSERT OR UPDATE ON "public"."rd_applications" FOR EACH ROW EXECUTE FUNCTION "public"."protect_rd_status"();



CREATE OR REPLACE TRIGGER "trg_protect_report_intake" BEFORE INSERT ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."protect_report_intake"();



CREATE OR REPLACE TRIGGER "trg_protect_verification_status" BEFORE INSERT OR UPDATE ON "public"."verification_records" FOR EACH ROW EXECUTE FUNCTION "public"."protect_verification_status"();



CREATE OR REPLACE TRIGGER "trg_validate_post_media" BEFORE INSERT OR UPDATE OF "media" ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."validate_post_media"();



ALTER TABLE ONLY "public"."access_purchases"
    ADD CONSTRAINT "access_purchases_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_memberships"
    ADD CONSTRAINT "channel_memberships_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_memberships"
    ADD CONSTRAINT "channel_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_thread_participants"
    ADD CONSTRAINT "direct_thread_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_thread_participants"
    ADD CONSTRAINT "direct_thread_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_host_business_id_fkey" FOREIGN KEY ("host_business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itineraries"
    ADD CONSTRAINT "itineraries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itinerary_items"
    ADD CONSTRAINT "itinerary_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itinerary_items"
    ADD CONSTRAINT "itinerary_items_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itinerary_items"
    ADD CONSTRAINT "itinerary_items_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_hides"
    ADD CONSTRAINT "message_hides_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_hides"
    ADD CONSTRAINT "message_hides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_bookmarks"
    ADD CONSTRAINT "post_bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_bookmarks"
    ADD CONSTRAINT "post_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reposts"
    ADD CONSTRAINT "post_reposts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reposts"
    ADD CONSTRAINT "post_reposts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_shares"
    ADD CONSTRAINT "post_shares_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_shares"
    ADD CONSTRAINT "post_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rd_applications"
    ADD CONSTRAINT "rd_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_keys"
    ADD CONSTRAINT "thread_keys_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_keys"
    ADD CONSTRAINT "thread_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_keys"
    ADD CONSTRAINT "thread_keys_wrapped_by_fkey" FOREIGN KEY ("wrapped_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_key_recovery"
    ADD CONSTRAINT "user_key_recovery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_keys"
    ADD CONSTRAINT "user_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verification_records"
    ADD CONSTRAINT "verification_records_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE "public"."access_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "access_purchases_select_own" ON "public"."access_purchases" FOR SELECT TO "authenticated" USING (("buyer_user_id" = "auth"."uid"()));



ALTER TABLE "public"."access_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users_select_self" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_admin_select" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "audit_logs_insert_self" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (("actor_id" = "auth"."uid"()));



ALTER TABLE "public"."business_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_members_select" ON "public"."business_members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "business_members_write_owner" ON "public"."business_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_members"."business_id") AND ("b"."owner_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_members"."business_id") AND ("b"."owner_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "businesses_admin_delete" ON "public"."businesses" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "businesses_admin_insert" ON "public"."businesses" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "businesses_admin_update" ON "public"."businesses" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "businesses_delete_owner" ON "public"."businesses" FOR DELETE TO "authenticated" USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "businesses_insert_owner" ON "public"."businesses" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "businesses_select" ON "public"."businesses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "businesses_update_owner" ON "public"."businesses" FOR UPDATE TO "authenticated" USING (("owner_user_id" = "auth"."uid"()));



ALTER TABLE "public"."channel_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_memberships_delete_own" ON "public"."channel_memberships" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "channel_memberships_insert_own" ON "public"."channel_memberships" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."channels" "c"
  WHERE (("c"."id" = "channel_memberships"."channel_id") AND ("c"."is_private" = false) AND ("c"."min_tier" IS NULL))))));



CREATE POLICY "channel_memberships_select" ON "public"."channel_memberships" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channels_select" ON "public"."channels" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consents_insert_own" ON "public"."consents" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "consents_select_own" ON "public"."consents" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."direct_thread_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_threads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "direct_threads_select_participant" ON "public"."direct_threads" FOR SELECT TO "authenticated" USING ("private"."is_thread_participant"("id"));



CREATE POLICY "dtp_select_own" ON "public"."direct_thread_participants" FOR SELECT TO "authenticated" USING ("private"."is_thread_participant"("thread_id"));



CREATE POLICY "dtp_update_own" ON "public"."direct_thread_participants" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_delete_host" ON "public"."events" FOR DELETE TO "authenticated" USING (("host_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "events_insert_host" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ((("host_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("host_business_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "events"."host_business_id") AND ("b"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "events_select" ON "public"."events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "events_update_host" ON "public"."events" FOR UPDATE TO "authenticated" USING (("host_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("host_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_insert_own" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "feedback_select_own_or_admin" ON "public"."feedback" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."is_admin"()));



CREATE POLICY "feedback_update_admin" ON "public"."feedback" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."festivals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "festivals_select" ON "public"."festivals" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invites_insert_owner" ON "public"."invites" FOR INSERT WITH CHECK ((("type" = 'business_member'::"text") AND ("from_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "invites"."business_id") AND ("b"."owner_user_id" = "auth"."uid"()))))));



CREATE POLICY "invites_select_related" ON "public"."invites" FOR SELECT TO "authenticated" USING ((("from_user_id" = "auth"."uid"()) OR (("business_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "invites"."business_id") AND ("b"."owner_user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."itineraries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "itineraries_delete_own" ON "public"."itineraries" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "itineraries_insert_own" ON "public"."itineraries" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "itineraries_select_own" ON "public"."itineraries" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "itineraries_update_own" ON "public"."itineraries" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."itinerary_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "itinerary_items_delete_own" ON "public"."itinerary_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."itineraries" "i"
  WHERE (("i"."id" = "itinerary_items"."itinerary_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "itinerary_items_insert_own" ON "public"."itinerary_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."itineraries" "i"
  WHERE (("i"."id" = "itinerary_items"."itinerary_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "itinerary_items_select_own" ON "public"."itinerary_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."itineraries" "i"
  WHERE (("i"."id" = "itinerary_items"."itinerary_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "itinerary_items_update_own" ON "public"."itinerary_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."itineraries" "i"
  WHERE (("i"."id" = "itinerary_items"."itinerary_id") AND ("i"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."message_hides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_hides_all_own" ON "public"."message_hides" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."message_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_reactions_delete_own" ON "public"."message_reactions" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "message_reactions_insert_own" ON "public"."message_reactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "private"."can_access_message"("message_id")));



CREATE POLICY "message_reactions_select" ON "public"."message_reactions" FOR SELECT TO "authenticated" USING ("private"."can_access_message"("message_id"));



CREATE POLICY "message_reactions_update_own" ON "public"."message_reactions" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_sender" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND ((("channel_id" IS NOT NULL) AND ("thread_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."channel_memberships" "cm"
  WHERE (("cm"."channel_id" = "messages"."channel_id") AND ("cm"."user_id" = "auth"."uid"()))))) OR (("thread_id" IS NOT NULL) AND ("channel_id" IS NULL) AND "private"."is_thread_participant"("thread_id")))));



CREATE POLICY "messages_select_participant" ON "public"."messages" FOR SELECT TO "authenticated" USING (((("channel_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."channel_memberships" "cm"
  WHERE (("cm"."channel_id" = "messages"."channel_id") AND ("cm"."user_id" = "auth"."uid"()))))) OR (("thread_id" IS NOT NULL) AND "private"."is_thread_participant"("thread_id"))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("recipient_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("recipient_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("recipient_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."offerings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "offerings_delete" ON "public"."offerings" FOR DELETE TO "authenticated" USING (((("owner_type" = 'profile'::"text") AND ("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("owner_type" = 'business'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "offerings"."business_id") AND ("b"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "offerings_insert" ON "public"."offerings" FOR INSERT TO "authenticated" WITH CHECK (((("owner_type" = 'profile'::"text") AND ("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("owner_type" = 'business'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "offerings"."business_id") AND ("b"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "offerings_select" ON "public"."offerings" FOR SELECT TO "authenticated" USING ((("status" = 'published'::"text") OR (("owner_type" = 'profile'::"text") AND ("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("owner_type" = 'business'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "offerings"."business_id") AND ("b"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "offerings_update" ON "public"."offerings" FOR UPDATE TO "authenticated" USING (((("owner_type" = 'profile'::"text") AND ("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("owner_type" = 'business'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "offerings"."business_id") AND ("b"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")))))))) WITH CHECK (((("owner_type" = 'profile'::"text") AND ("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("owner_type" = 'business'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "offerings"."business_id") AND ("b"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."post_bookmarks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_bookmarks_delete_own" ON "public"."post_bookmarks" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "post_bookmarks_insert_own" ON "public"."post_bookmarks" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "post_bookmarks_select_own" ON "public"."post_bookmarks" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_comments_insert_own" ON "public"."post_comments" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND "private"."can_write_content"()));



CREATE POLICY "post_comments_select" ON "public"."post_comments" FOR SELECT USING (true);



CREATE POLICY "post_comments_update_own" ON "public"."post_comments" FOR UPDATE USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "post_comments_update_post_author" ON "public"."post_comments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_comments"."post_id") AND ("p"."author_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_comments"."post_id") AND ("p"."author_id" = "auth"."uid"())))));



ALTER TABLE "public"."post_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_reactions_delete_own" ON "public"."post_reactions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "post_reactions_insert_own" ON "public"."post_reactions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "post_reactions_select" ON "public"."post_reactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "post_reactions_update_own" ON "public"."post_reactions" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."post_reposts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_reposts_delete_own" ON "public"."post_reposts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "post_reposts_insert_own" ON "public"."post_reposts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("quote" IS NULL) OR "private"."can_write_content"())));



CREATE POLICY "post_reposts_select" ON "public"."post_reposts" FOR SELECT USING (true);



ALTER TABLE "public"."post_shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_shares_insert_own" ON "public"."post_shares" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "post_shares_select_scoped" ON "public"."post_shares" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_shares"."post_id") AND ("p"."author_id" = "auth"."uid"()))))));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete_own" ON "public"."posts" FOR DELETE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "posts_insert_own" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND "private"."can_write_content"()));



CREATE POLICY "posts_select" ON "public"."posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "posts_update_own" ON "public"."posts" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("private"."can_view_profile"("id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "public can request access" ON "public"."access_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK (("source" = 'homepage'::"text"));



ALTER TABLE "public"."rd_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rd_apps_insert_own" ON "public"."rd_applications" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "rd_apps_select_own_or_admin" ON "public"."rd_applications" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "rd_apps_update_admin" ON "public"."rd_applications" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "rd_apps_update_own" ON "public"."rd_applications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_admin_all" ON "public"."reports" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "reports_insert_own" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "reports_select_own" ON "public"."reports" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));



ALTER TABLE "public"."rsvps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rsvps_delete_own" ON "public"."rsvps" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "rsvps_insert_own" ON "public"."rsvps" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "rsvps_select" ON "public"."rsvps" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."thread_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "thread_keys_insert_participant" ON "public"."thread_keys" FOR INSERT TO "authenticated" WITH CHECK (("private"."is_thread_participant"("thread_id") AND ("wrapped_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "thread_keys_select_own" ON "public"."thread_keys" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."user_key_recovery" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_key_recovery_all_own" ON "public"."user_key_recovery" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."user_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_keys_insert_own" ON "public"."user_keys" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "user_keys_select_all" ON "public"."user_keys" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_keys_update_own" ON "public"."user_keys" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "verification_insert_own" ON "public"."verification_records" FOR INSERT WITH CHECK (((("subject_type" = 'user'::"text") AND ("subject_id" = "auth"."uid"())) OR (("subject_type" = 'business'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "verification_records"."subject_id") AND ("b"."owner_user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."verification_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "verification_records_admin_all" ON "public"."verification_records" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));



CREATE POLICY "verification_select_own" ON "public"."verification_records" FOR SELECT TO "authenticated" USING (((("subject_type" = 'user'::"text") AND ("subject_id" = "auth"."uid"())) OR (("subject_type" = 'business'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "verification_records"."subject_id") AND ("b"."owner_user_id" = "auth"."uid"())))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."direct_thread_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."message_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."post_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."post_reactions";



GRANT USAGE ON SCHEMA "private" TO "authenticated";
GRANT USAGE ON SCHEMA "private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "private"."can_view_profile"("target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_view_profile"("target" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_write_avatar"("object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_write_avatar"("object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_write_content"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_write_content"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "private"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."is_thread_participant"("p_thread" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_thread_participant"("p_thread" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."is_thread_participant"("p_thread" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."is_trusted_writer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_trusted_writer"() TO "authenticated";
GRANT ALL ON FUNCTION "private"."is_trusted_writer"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_delete_account"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_account"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_account"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_message_for_everyone"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_message_for_everyone"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_message_for_everyone"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_own_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."edit_message"("p_id" "uuid", "p_body" "text", "p_body_iv" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."edit_message"("p_id" "uuid", "p_body" "text", "p_body_iv" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."edit_message"("p_id" "uuid", "p_body" "text", "p_body_iv" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_comment_depth"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_comment_depth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_comment_depth"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_reply_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_reply_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_repost_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_repost_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_repost_view"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_user_id_by_email"("lookup_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_user_id_by_email"("lookup_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_direct_thread"("other_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_direct_thread"("other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_thread"("other_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_post_comment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_post_comment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_post_reaction"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_post_reaction"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_post_repost"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_post_repost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_business_trust_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_business_trust_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_business_trust_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_dtp_identity"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_dtp_identity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_dtp_identity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_feedback_intake"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_feedback_intake"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_feedback_intake"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_notification_columns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_notification_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_post_body_edits"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_post_body_edits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_post_body_edits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_post_comment_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_post_comment_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_post_comment_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_profile_trust_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_profile_trust_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_profile_trust_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_rd_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_rd_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_rd_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_report_intake"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_report_intake"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_report_intake"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_verification_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_verification_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_verification_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."redeem_business_invite"("invite_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_business_invite"("invite_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_business_invite"("invite_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_post_media"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_post_media"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_post_media"() TO "service_role";


















GRANT ALL ON TABLE "public"."access_purchases" TO "anon";
GRANT ALL ON TABLE "public"."access_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."access_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."access_requests" TO "anon";
GRANT ALL ON TABLE "public"."access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."access_requests" TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."business_members" TO "anon";
GRANT ALL ON TABLE "public"."business_members" TO "authenticated";
GRANT ALL ON TABLE "public"."business_members" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."channel_memberships" TO "anon";
GRANT ALL ON TABLE "public"."channel_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";



GRANT ALL ON TABLE "public"."consents" TO "anon";
GRANT ALL ON TABLE "public"."consents" TO "authenticated";
GRANT ALL ON TABLE "public"."consents" TO "service_role";



GRANT ALL ON TABLE "public"."direct_thread_participants" TO "anon";
GRANT ALL ON TABLE "public"."direct_thread_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_thread_participants" TO "service_role";



GRANT ALL ON TABLE "public"."direct_threads" TO "anon";
GRANT ALL ON TABLE "public"."direct_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_threads" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."festivals" TO "anon";
GRANT ALL ON TABLE "public"."festivals" TO "authenticated";
GRANT ALL ON TABLE "public"."festivals" TO "service_role";



GRANT ALL ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT ALL ON TABLE "public"."invites" TO "service_role";



GRANT ALL ON TABLE "public"."itineraries" TO "anon";
GRANT ALL ON TABLE "public"."itineraries" TO "authenticated";
GRANT ALL ON TABLE "public"."itineraries" TO "service_role";



GRANT ALL ON TABLE "public"."itinerary_items" TO "anon";
GRANT ALL ON TABLE "public"."itinerary_items" TO "authenticated";
GRANT ALL ON TABLE "public"."itinerary_items" TO "service_role";



GRANT ALL ON TABLE "public"."message_hides" TO "anon";
GRANT ALL ON TABLE "public"."message_hides" TO "authenticated";
GRANT ALL ON TABLE "public"."message_hides" TO "service_role";



GRANT ALL ON TABLE "public"."message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."offerings" TO "anon";
GRANT ALL ON TABLE "public"."offerings" TO "authenticated";
GRANT ALL ON TABLE "public"."offerings" TO "service_role";



GRANT ALL ON TABLE "public"."post_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."post_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."post_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_reactions" TO "anon";
GRANT ALL ON TABLE "public"."post_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."post_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."post_reposts" TO "anon";
GRANT ALL ON TABLE "public"."post_reposts" TO "authenticated";
GRANT ALL ON TABLE "public"."post_reposts" TO "service_role";



GRANT ALL ON TABLE "public"."post_shares" TO "anon";
GRANT ALL ON TABLE "public"."post_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."post_shares" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rd_applications" TO "anon";
GRANT ALL ON TABLE "public"."rd_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."rd_applications" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."rsvps" TO "anon";
GRANT ALL ON TABLE "public"."rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."thread_keys" TO "anon";
GRANT ALL ON TABLE "public"."thread_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_key_recovery" TO "anon";
GRANT ALL ON TABLE "public"."user_key_recovery" TO "authenticated";
GRANT ALL ON TABLE "public"."user_key_recovery" TO "service_role";



GRANT ALL ON TABLE "public"."user_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_trust_tiers" TO "anon";
GRANT ALL ON TABLE "public"."user_trust_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_trust_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."verification_records" TO "anon";
GRANT ALL ON TABLE "public"."verification_records" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_records" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































