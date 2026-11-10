-- =========================================================
-- 17. owner の役割を直す
--
--   【何が起きていたか】
--   Organisers タブで「Send invitation」を押しても
--   「Only the owner can invite organisers.」で止まります。
--
--   admins には note（ただの覚え書き）と role（本物の役割）の
--   2つがあります。招待できるのは role = 'owner' の人だけです
--   （10-owner-and-cancel.sql）。
--   ところが 16-admin-owner.sql は note に 'owner' と書くだけで、
--   role は既定の 'organiser' のまま入っていました。
--   そのため管理画面は開けても、主催者を増やせませんでした。
--
--   このファイルは role を 'owner' に直します。
--   消すものはありません。足りない役割を付けるだけです。
--
--   【実行前に】
--   下の OWNER_EMAIL が、ふだんサイトにサインインしている
--   アドレスと同じか確かめてください。
--   そのアドレスでサイトに会員登録が済んでいる必要があります。
--     https://www.asiansocials.nl/ → Membership → アカウント作成
-- =========================================================

do $$
declare
  owner_email constant text := 't.iino@asiansocials.nl';   -- ← ここだけ書き換えれば他の人にも移せます
  owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = lower(owner_email);

  if owner_id is null then
    raise exception
      '中止しました: % は Supabase Auth にいません。先にそのアドレスでサイトに登録してください。',
      owner_email;
  end if;

  -- 管理者として登録し、役割を owner にします。
  -- すでに居る人なら、役割だけ上げます（note は触りません）。
  insert into admins (user_id, note, role)
       values (owner_id, 'owner', 'owner')
  on conflict (user_id) do update set role = 'owner';

  raise notice 'owner にしました: % (%)', owner_email, owner_id;
end $$;


-- --- 確認 -------------------------------------------------
-- role の列に owner が1行あれば成功です。
-- その行のアドレスでサインインすると、Organisers タブから
-- メールアドレスで主催者を増やせるようになります。
select u.email, a.role, a.note, a.created_at
  from admins a
  join auth.users u on u.id = a.user_id
 order by (a.role = 'owner') desc, a.created_at;
