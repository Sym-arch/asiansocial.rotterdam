-- =========================================================
-- ① オーナーを設ける  ② 予約の取り消し
--
-- 02 / 04 / 08 を実行済みであることが前提です。
-- Supabase の SQL Editor に貼って実行してください。
-- 何度実行しても同じ結果になります。
--
-- ①なぜオーナーが要るのか:
--   いまは主催者どうしが対等なので、招いた相手があなたを外せます。
--   主催者を増やすほど、その危険は上がります。
--   「イベントを運営する人」と「運営する人を決める人」を分けます。
-- =========================================================


-- ---------------------------------------------------------
-- 1. 役割の列
-- ---------------------------------------------------------
alter table admins add column if not exists role text not null default 'organiser';

alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check check (role in ('owner', 'organiser'));

-- これまで note に 'owner' と書いてあった行を、正式な役割に移します
update admins set role = 'owner' where role <> 'owner' and coalesce(note, '') = 'owner';

-- 万一ひとりもオーナーが居なければ、最初の管理者をオーナーにします。
-- 誰もオーナーでない状態は、誰も主催者を足せない状態です。
update admins set role = 'owner'
 where user_id = (select user_id from admins order by created_at limit 1)
   and not exists (select 1 from admins where role = 'owner');


-- ---------------------------------------------------------
-- 2. オーナー判定
-- ---------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid() and role = 'owner');
$$;


-- ---------------------------------------------------------
-- 3. 一覧（役割も返します）
--
--    列が増えるので、create or replace では差し替えられません
--    （戻り値の形が変わる関数は置き換えられない決まりです）。
--    先に落としてから作り直します。
-- ---------------------------------------------------------
drop function if exists public.admin_list();

create or replace function public.admin_list()
returns table (user_id uuid, email text, note text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not_an_organiser';
  end if;

  return query
    select a.user_id, u.email::text, a.note, a.role, a.created_at
      from admins a
      join auth.users u on u.id = a.user_id
     order by (a.role = 'owner') desc, a.created_at;
end;
$$;


-- ---------------------------------------------------------
-- 4. 削除（オーナーだけ）
--
--    オーナーは外せません。自分自身も外せません。
--    どちらも「誰も入れなくなる」を防ぐためです。
-- ---------------------------------------------------------
create or replace function public.admin_remove(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not is_owner() then
    raise exception 'owner_only';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot_remove_self';
  end if;

  if exists (select 1 from admins where user_id = p_user_id and role = 'owner') then
    raise exception 'cannot_remove_owner';
  end if;

  delete from admins where user_id = p_user_id;
end;
$$;

revoke all on function public.is_owner()          from public;
revoke all on function public.admin_list()        from public;
revoke all on function public.admin_remove(uuid)  from public;
grant execute on function public.is_owner()       to authenticated;
grant execute on function public.admin_list()     to authenticated;
grant execute on function public.admin_remove(uuid) to authenticated;

-- admin_add はもう使いません（招待は /api/organiser が行います）
drop function if exists public.admin_add(text, text);


-- =========================================================
-- ② 自分の予約を取り消す
--
-- なぜ関数なのか:
--   取り消しは3つの表にまたがります。チケットを無効にし、
--   受付名簿から消し、注文の状態を変える。ばらばらに行うと
--   途中で失敗したときに、片方だけ消えた状態が残ります。
--
-- 誰が呼べるか:
--   サインインしている本人だけです。チケットの鍵を知っているだけでは
--   取り消せません。転送されたスクリーンショットで他人の予約を
--   消せてしまうためです。
-- =========================================================

create or replace function public.cancel_my_booking(p_secret text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t        record;
  v_email  text;
begin
  if auth.uid() is null then
    raise exception 'sign_in_required';
  end if;

  select * into t from tickets where secret = p_secret;
  if t is null then
    raise exception 'no_such_ticket';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if not (t.user_id = auth.uid() or lower(t.email) = v_email) then
    raise exception 'not_your_booking';
  end if;

  if t.status = 'used' then
    raise exception 'already_used';
  end if;
  if t.status = 'void' then
    return t.event_id;                      -- すでに取り消し済み。黙って通します
  end if;

  -- 終わった回は取り消せません。名簿を後から書き換えないためです
  if t.event_date is not null and t.event_date::date < current_date then
    raise exception 'event_passed';
  end if;

  update tickets set status = 'void' where id = t.id;

  delete from rsvps
   where event_id = t.event_id
     and lower(email) = lower(t.email);

  if t.order_id is not null then
    update orders set status = 'cancelled' where id = t.order_id;
  end if;

  insert into ticket_history (ticket_id, action, detail, by_email)
       values (t.id, 'cancelled', jsonb_build_object('by', 'member'), t.email);

  return t.event_id;
end;
$$;

revoke all on function public.cancel_my_booking(text) from public;
grant execute on function public.cancel_my_booking(text) to authenticated;
