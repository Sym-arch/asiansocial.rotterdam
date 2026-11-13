-- =========================================================
-- 22. Google でサインインした人の名前も拾う
--
-- 流し方: Supabase → SQL Editor に全部貼って Run。何度流しても壊れません。
--
-- これまでの handle_new_user() は raw_user_meta_data の 'name' だけを
-- 見ていました。メール＋パスワードの新規登録ではこれで合っていますが、
-- Google でサインインすると、Google 側が入れてくるキーは 'full_name' の
-- ことが多く、そのままだと名前が空のままプロフィールが作られていました。
-- 'name' を優先しつつ、無ければ 'full_name' も見るようにします。
--
-- 管理画面・サイト側のコードは変えていません（この関数だけの修正です）。
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id, new.email,
    nullif(coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name'
    ), '')
  )
  on conflict (id) do nothing;

  insert into public.memberships (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- すでに Google でサインインしてしまい、名前が空のままの人がいれば埋めます
update profiles p
set name = nullif(coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name'), '')
from auth.users u
where p.id = u.id
  and (p.name is null or p.name = '')
  and coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name') is not null;
