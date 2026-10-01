-- =========================================================
-- 予約は「自分のぶんだけ」見えるようにします
--
-- これまでの状態:
--   create policy "auth read rsvps"   on rsvps for select to authenticated using ( true );
--   create policy "auth delete rsvps" on rsvps for delete to authenticated using ( true );
--
--   サインインしていれば、誰でも全員の予約を読めて、消せました。
--   そのためマイページに他の人の予約が並び、その行から「チケットを開く」を
--   押すと、他人の予約に対して発券しようとして衝突していました。
--   （名前とメールアドレスが他の会員から見えてしまう問題でもあります）
--
-- これから:
--   本人  … 自分のメールアドレスの予約だけ読める
--   管理者 … 全部読める・消せる（受付名簿と管理画面のため）
--
-- 02-lockdown.sql の is_admin() を使います。先にそちらを実行してください。
-- 何度実行しても同じ結果になります。
-- =========================================================

drop policy if exists "auth read rsvps"   on rsvps;
drop policy if exists "auth delete rsvps" on rsvps;

drop policy if exists "read own rsvps" on rsvps;
create policy "read own rsvps" on rsvps
  for select to authenticated
  using ( lower(email) = lower(auth.jwt() ->> 'email') );

drop policy if exists "admin read rsvps" on rsvps;
create policy "admin read rsvps" on rsvps
  for select to authenticated
  using ( is_admin() );

drop policy if exists "admin delete rsvps" on rsvps;
create policy "admin delete rsvps" on rsvps
  for delete to authenticated
  using ( is_admin() );

-- 確認:
--   管理者で   select count(*) from rsvps;  → 全件
--   一般会員で select count(*) from rsvps;  → 自分のぶんだけ
