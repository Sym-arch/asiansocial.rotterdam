-- =========================================================
-- フェーズ1 — 会員の土台（profiles / memberships）
--
-- 02-lockdown.sql を実行済みであることが前提です（is_admin() を使います）。
-- Supabase の SQL Editor に全部貼り付けて実行してください。書き換え不要です。
--
-- ここで作るもの:
--   profiles     … 会員の表示用データ（名前・言語・Stripeの顧客ID）
--   memberships  … 会員ランク（free / premium）と状態
--   トリガー      … アカウントが作られたら上の2行を自動で用意する
--
-- 「非会員」はテーブルに現れません。サイトから予約した人は必ず
-- アカウントが作られ、その時点で無料会員になります。非会員とは
-- 「まだ登録していない閲覧者」であって、会員ランクではありません。
-- =========================================================


-- ---------------------------------------------------------
-- 1. プロフィール
-- ---------------------------------------------------------
create table if not exists profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null,
  name               text,
  locale             text default 'en',
  -- 単発のチケット決済でも最初から Stripe の顧客を作って紐付けます。
  -- これを省くと、後で有料会員（継続課金）を足したときに
  -- 同じ人が別顧客として増え、購入履歴が分断されます。
  stripe_customer_id text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists profiles_email_idx on profiles (email);


-- ---------------------------------------------------------
-- 2. 会員ランク
--    有料会員はまだ始めませんが、列は最初から用意します。
--    後から足すより、空のまま持っておくほうが安全です。
-- ---------------------------------------------------------
create table if not exists memberships (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  tier                   text not null default 'free',
  status                 text not null default 'active',
  started_at             timestamptz default now(),
  expires_at             timestamptz,          -- free は null（期限なし）
  stripe_subscription_id text,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  constraint memberships_tier_check
    check (tier in ('free', 'premium')),
  constraint memberships_status_check
    check (status in ('active', 'past_due', 'cancelled', 'expired'))
);


-- ---------------------------------------------------------
-- 3. updated_at を実際に更新する
--    列だけ作って更新しないと、値が嘘になります。
-- ---------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists memberships_touch on memberships;
create trigger memberships_touch before update on memberships
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------
-- 4. アカウント作成時に profiles と memberships を自動で用意する
--    予約した人が「気づいたら無料会員になっている」のはここです。
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, nullif(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;

  insert into public.memberships (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------
-- 5. すでにいるユーザーの分を用意する（トリガーは新規だけに効くため）
-- ---------------------------------------------------------
insert into profiles (id, email)
select id, email from auth.users
    on conflict (id) do nothing;

insert into memberships (user_id)
select id from auth.users
    on conflict (user_id) do nothing;


-- ---------------------------------------------------------
-- 6. 読み書きの制限
-- ---------------------------------------------------------
alter table profiles    enable row level security;
alter table memberships enable row level security;

-- 本人は自分の行だけ
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles
  for select to authenticated using ( id = auth.uid() );

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
  for update to authenticated using ( id = auth.uid() ) with check ( id = auth.uid() );

drop policy if exists "admin read profiles" on profiles;
create policy "admin read profiles" on profiles
  for select to authenticated using ( is_admin() );

-- 会員ランクは「読むだけ」。本人には更新させません。
-- ここを開けると、自分で premium に書き換えられてしまいます。
-- 変更するのは管理者か、Stripe の webhook（service_role でRLSを迂回）だけです。
drop policy if exists "read own membership" on memberships;
create policy "read own membership" on memberships
  for select to authenticated using ( user_id = auth.uid() );

drop policy if exists "admin read memberships" on memberships;
create policy "admin read memberships" on memberships
  for select to authenticated using ( is_admin() );

drop policy if exists "admin write memberships" on memberships;
create policy "admin write memberships" on memberships
  for all to authenticated using ( is_admin() ) with check ( is_admin() );


-- ---------------------------------------------------------
-- 7. 列単位の制限
--    RLS は「どの行か」しか見ません。本人が自分の行を更新できる以上、
--    stripe_customer_id まで書き換えられてしまいます。
--    そこで、本人が触れる列を name と locale だけに絞ります。
-- ---------------------------------------------------------
revoke update on profiles from authenticated;
grant  update (name, locale) on profiles to authenticated;

revoke insert, update, delete on memberships from authenticated;


-- ---------------------------------------------------------
-- 8. EN（日本コミュニティ）用の列
--    会員基盤は共通のまま、イベントだけブランドで分けます。
--    'en' は言語コード（?lang=en）と紛らわしいので使いません。
-- ---------------------------------------------------------
alter table events add column if not exists brand text not null default 'asian-social';

alter table events drop constraint if exists events_brand_check;
alter table events add  constraint events_brand_check
  check (brand in ('asian-social', 'en-community'));

create index if not exists events_brand_date_idx on events (brand, date);


-- =========================================================
-- 実行後の確認
--
--   select count(*) from profiles;      -- auth.users と同じ数になる
--   select count(*) from memberships;   -- 同上
--   select tier, status from memberships;
--
-- このあと Authentication → Sign In / Providers で
-- Email の「Enable Sign Ups」を ON に戻します。
--   02-lockdown.sql で admins テーブルを作ったので、
--   ログインできても admins に載っていなければ何の権限もありません。
--   サインアップを開いても、増えるのは無料会員の行だけです。
-- =========================================================
