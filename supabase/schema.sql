-- Asian Social Rotterdam — イベントと note 記事のテーブル
-- Supabase の SQL Editor にそのまま貼り付けて実行してください。
--
-- なぜ必要か:
--   これまでイベントは「投稿した人のブラウザ」にしか保存されていませんでした。
--   そのため他の訪問者には何も見えず、翻訳ページ（別ドメイン扱い）でも空になります。
--   このテーブルに載せると、全員が同じイベントを見られるようになります。

create table if not exists events (
  id          text primary key,
  title       text not null,
  date        date not null,
  start_time  text,
  end_time    text,
  venue       text,
  address     text,
  price       text,
  image       text,
  description text,
  created_at  timestamptz default now()
);

create table if not exists notes (
  id          text primary key,
  title       text not null,
  url         text not null,
  date        date,
  tag         text,
  image       text,
  description text,
  created_at  timestamptz default now()
);

alter table events enable row level security;
alter table notes  enable row level security;

-- 誰でも読める（サイトの訪問者向け）
create policy "public read events" on events for select using ( true );
create policy "public read notes"  on notes  for select using ( true );

-- Admin 画面から書き込める（anon キー）
create policy "anon write events"  on events for insert to anon with check ( true );
create policy "anon update events" on events for update to anon using ( true );
create policy "anon delete events" on events for delete to anon using ( true );

create policy "anon write notes"   on notes  for insert to anon with check ( true );
create policy "anon update notes"  on notes  for update to anon using ( true );
create policy "anon delete notes"  on notes  for delete to anon using ( true );

-- ⚠️ 注意
--   anon キーはブラウザのソースに含まれるため、上の書き込みポリシーは
--   「キーを見た人なら誰でもイベントを追加・削除できる」状態を意味します。
--   小規模なうちは実害が出にくいものの、リスクではあります。
--   本格運用の前に Supabase Auth でログインを入れ、書き込みポリシーを
--   `to authenticated` に変更することをおすすめします:
--
--     drop policy "anon write events"  on events;
--     create policy "auth write events" on events for insert to authenticated with check ( true );
--     （update / delete / notes も同様）
