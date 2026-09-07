-- =========================================================
-- フェーズ0 — 書き込みを管理者だけに絞る
--
-- Supabase の SQL Editor に全部貼り付けて実行してください。
-- 3行目の「ここを自分のメールアドレスに」だけ書き換えが必要です。
--
-- なぜ今やるのか:
--   いまは匿名キーでイベントとnote記事を追加・更新・削除できます。
--   匿名キーはページのソースに含まれるので、見た人は誰でも書けます。
--   さらに rsvps の読み取りが「ログイン済みなら誰でも」になっており、
--   会員アカウントを作り始めると全会員が参加者名簿を読めてしまいます。
--   お金と会員を扱う前に、両方を塞ぎます。
--
-- なぜ `to authenticated` だけでは足りないのか:
--   authenticated は「ログインしている人すべて」です。
--   これから訪問者にもアカウントを作るので、それだけだと
--   一般会員がイベントを消せることになります。
--   そこで admins テーブルを作り、そこに載っている人だけを管理者とします。
-- =========================================================


-- ---------------------------------------------------------
-- 1. 管理者テーブル
-- ---------------------------------------------------------
create table if not exists admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz default now()
);

alter table admins enable row level security;

-- 自分が管理者かどうかだけ確認できる（他人の行は見えない）
drop policy if exists "read own admin row" on admins;
create policy "read own admin row" on admins
  for select to authenticated using ( user_id = auth.uid() );


-- ---------------------------------------------------------
-- 2. 管理者判定の関数
--    security definer は、admins 自身の RLS に邪魔されずに
--    読むために必要です。search_path の固定は定石の安全対策です。
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;


-- ---------------------------------------------------------
-- 3. 自分を管理者として登録
--    ↓ Supabase Auth で作った管理者アカウントのメールアドレスに書き換える
-- ---------------------------------------------------------
insert into admins (user_id, note)
select id, 'owner'
  from auth.users
 where email = 't.iino@sym-arch.com'
    on conflict (user_id) do nothing;


-- ---------------------------------------------------------
-- 4. イベントとnote記事：書き込みを管理者だけに
--    読み取りは公開のまま（サイトの訪問者が見るため）
-- ---------------------------------------------------------
drop policy if exists "anon write events"  on events;
drop policy if exists "anon update events" on events;
drop policy if exists "anon delete events" on events;

create policy "admin write events"  on events
  for insert to authenticated with check ( is_admin() );
create policy "admin update events" on events
  for update to authenticated using ( is_admin() ) with check ( is_admin() );
create policy "admin delete events" on events
  for delete to authenticated using ( is_admin() );

-- notes は廃止済みです（06-drop-notes.sql）。テーブルが無い状態でここを流すと
-- エラーになります。その場合はこの notes の塊を飛ばしてください。
drop policy if exists "anon write notes"   on notes;
drop policy if exists "anon update notes"  on notes;
drop policy if exists "anon delete notes"  on notes;

create policy "admin write notes"   on notes
  for insert to authenticated with check ( is_admin() );
create policy "admin update notes"  on notes
  for update to authenticated using ( is_admin() ) with check ( is_admin() );
create policy "admin delete notes"  on notes
  for delete to authenticated using ( is_admin() );


-- ---------------------------------------------------------
-- 5. 予約：追加は誰でも、読み取りと削除は管理者だけ
--
--    実際のポリシーを確認したところ2点ずれていました。
--    ・INSERT が {anon} だけ → ログイン中の会員が予約すると弾かれます
--      （リクエストが authenticated ロールで届くため）。会員を作る前に直します。
--    ・DELETE のポリシーが存在しない → 管理者でも予約を削除できません。
-- ---------------------------------------------------------
drop policy if exists "anon insert rsvps" on rsvps;
create policy "anyone insert rsvps" on rsvps
  for insert to anon, authenticated with check ( true );

drop policy if exists "auth read rsvps"   on rsvps;
drop policy if exists "auth delete rsvps" on rsvps;

create policy "admin read rsvps"   on rsvps
  for select to authenticated using ( is_admin() );
create policy "admin delete rsvps" on rsvps
  for delete to authenticated using ( is_admin() );


-- ---------------------------------------------------------
-- 6. 画像アップロード：管理者だけに
--    読み取りは公開のまま（サイトで表示するため）
--
--    先に core.js の uploadImage を「ログイン中のトークンで送る」形に
--    変更済みであることが前提です。未変更のまま実行すると
--    Admin からのアップロードが 403 になります。
-- ---------------------------------------------------------
--    UPDATE のポリシーも匿名に開いていました（バケット内のファイルを
--    誰でも上書きできる状態）。サイトは上書きを使わないので、そのまま閉じます。
drop policy if exists "anon upload event-photos" on storage.objects;
drop policy if exists "anon update event-photos" on storage.objects;

create policy "admin upload event-photos" on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'event-photos' and is_admin() );


-- =========================================================
-- 実行後の確認
--
--   1. サイトの Admin にサインインして、イベントを1件編集して保存できるか
--   2. 写真をアップロードできるか
--   3. RSVPs タブに予約一覧が出るか
--
--   匿名キーで書けないことの確認（ターミナルから）:
--     curl -X POST 'https://<project>.supabase.co/rest/v1/events' \
--       -H 'apikey: <anon key>' -H 'Authorization: Bearer <anon key>' \
--       -H 'Content-Type: application/json' -d '{"id":"probe"}'
--   → 42501 / "violates row-level security policy" が返れば成功。
--     23502 / "null value in column" が返る場合はまだ塞がっていません。
-- =========================================================
