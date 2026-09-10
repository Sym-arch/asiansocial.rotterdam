-- =========================================================
-- 管理者を管理画面から追加・削除できるようにします
--
-- 02-lockdown.sql を実行済みであることが前提です。
-- Supabase の SQL Editor に貼って実行してください。
--
-- なぜ関数が要るのか:
--   管理者はメールアドレスで追加したいのですが、メールアドレスと
--   ユーザーIDの対応表は auth.users にあり、ここは PostgREST から
--   触れません（触れたら会員全員のアドレスが引けてしまいます）。
--   また admins テーブルは「自分の行しか読めない」ので、
--   一覧も素の select では作れません。
--
--   そこで、必要な操作だけを関数として開けます。
--   security definer なので関数の中では制限を越えられますが、
--   入口で is_admin() を見ているため、管理者以外は何もできません。
-- =========================================================


-- ---------------------------------------------------------
-- 1. 一覧
-- ---------------------------------------------------------
create or replace function public.admin_list()
returns table (user_id uuid, email text, note text, created_at timestamptz)
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
    select a.user_id, u.email::text, a.note, a.created_at
      from admins a
      join auth.users u on u.id = a.user_id
     order by a.created_at;
end;
$$;


-- ---------------------------------------------------------
-- 2. 追加
--    相手はすでにアカウントを持っている必要があります。
--    ここでアカウントごと作れるようにすると、招待メールの管理まで
--    抱えることになるので、先にサイトから登録してもらいます。
-- ---------------------------------------------------------
create or replace function public.admin_add(p_email text, p_note text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'not_an_organiser';
  end if;

  select id into v_id
    from auth.users
   where lower(email) = lower(trim(p_email))
   limit 1;

  if v_id is null then
    raise exception 'no_such_account';
  end if;

  insert into admins (user_id, note)
       values (v_id, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (user_id) do update set note = excluded.note;

  return v_id;
end;
$$;


-- ---------------------------------------------------------
-- 3. 削除
--
--    自分自身は外せません。全員が外れて誰も入れなくなる事故を
--    防ぐためです。辞めるときは、別の管理者に外してもらいます。
-- ---------------------------------------------------------
create or replace function public.admin_remove(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not_an_organiser';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot_remove_self';
  end if;

  if (select count(*) from admins) <= 1 then
    raise exception 'last_organiser';
  end if;

  delete from admins where user_id = p_user_id;
end;
$$;


-- ---------------------------------------------------------
-- 4. 呼べる人を絞ります
--    サインインしていない人には渡しません。
-- ---------------------------------------------------------
revoke all on function public.admin_list()             from public;
revoke all on function public.admin_add(text, text)    from public;
revoke all on function public.admin_remove(uuid)       from public;

grant execute on function public.admin_list()          to authenticated;
grant execute on function public.admin_add(text, text) to authenticated;
grant execute on function public.admin_remove(uuid)    to authenticated;


-- 確認: 管理者としてサインインした状態で実行すると一覧が返ります
-- select * from public.admin_list();
