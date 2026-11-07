-- =========================================================
-- 16. 管理者（owner）を新しいメールアドレスに移す
--
--   sym-arch.com を解約すると t.iino@sym-arch.com は消えます。
--   このアドレスは 02-lockdown.sql で admins に登録した
--   サイトの管理者そのものなので、先に移しておかないと
--   管理画面を開ける人がいなくなります。
--
--   【実行前に必ず】
--   新しいアドレスでサイトに会員登録しておいてください。
--     https://www.asiansocials.nl/ → Log in → アカウント作成
--   Supabase Auth にユーザーが無いと、このスクリプトは
--   何もせずに中止します（安全のため）。
--
--   旧アカウントは admins から外すだけで、削除はしません。
--   auth.users を消すと profiles と memberships が連鎖削除され、
--   会員番号や入会日まで消えるためです。
--   （tickets と orders は user_id が null になるだけで残ります）
-- =========================================================

do $$
declare
  new_id uuid;
  old_id uuid;
  n_admins int;
begin
  select id into new_id from auth.users where email = 't.iino@asiansocials.nl';
  select id into old_id from auth.users where email = 't.iino@sym-arch.com';

  -- 新しいアカウントが無ければ、何も変えずに知らせて終わります
  if new_id is null then
    raise exception
      '中止しました: t.iino@asiansocials.nl が Supabase Auth にいません。先にサイトで会員登録してください。';
  end if;

  -- 1. 新しいアドレスを管理者にする
  insert into admins (user_id, note)
       values (new_id, 'owner')
  on conflict (user_id) do update set note = 'owner';

  raise notice '新しい管理者を登録しました: t.iino@asiansocials.nl (%)', new_id;

  -- 2. 旧アドレスから管理者権限を外す
  --    ただし、管理者が1人も居なくなる事態は避けます
  if old_id is not null then
    select count(*) into n_admins from admins where user_id <> old_id;
    if n_admins >= 1 then
      delete from admins where user_id = old_id;
      raise notice '旧管理者を外しました: t.iino@sym-arch.com (%)', old_id;
    else
      raise exception '中止しました: 旧管理者を外すと管理者が居なくなります。';
    end if;
  else
    raise notice '旧アドレスの Auth ユーザーは見つかりませんでした（すでに削除済み？）';
  end if;
end $$;


-- --- 確認 -------------------------------------------------
-- 実行後、ここで1行だけ（新しいアドレス）返れば成功です。
select u.email, a.note, a.created_at
  from admins a
  join auth.users u on u.id = a.user_id
 order by a.created_at;
