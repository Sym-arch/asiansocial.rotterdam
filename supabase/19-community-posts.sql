-- =========================================================
-- 19. 参加者の写真とレビュー
--
-- 流し方: Supabase → SQL Editor に全部貼って Run。何度流しても壊れません。
--
-- 決めごと（本人と相談済み）:
--   - 写真を追加できるのは管理者だけ（まずは運営が撮った写真を載せる）。
--     参加者は見てダウンロードできる
--   - 感想を投稿できるのは、その回に参加した人だけ（予約かチケットがある会員）。
--     終わった回にだけ投稿できる
--   - 投稿はすぐ公開。問題があれば管理画面から消す
--   - 公開するのはイニシャルと国籍だけ。名前やメールアドレスは出さない
--
-- 以前の版（写真も参加者が追加できる形）をすでに流していても、
-- これをもう一度流せば権限が置き換わります。
-- =========================================================

-- ---------------------------------------------------------
-- 1. その回に参加したか
--    予約（rsvps）はメールアドレスで、チケット（tickets）は user_id か
--    メールアドレスで本人のものを探します。どちらかがあれば参加扱いです。
--    回が終わっているか（日付が今日以前か）もここで見ます。
-- ---------------------------------------------------------
create or replace function public.attended_event(p_event text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1 from events e
        where e.id = p_event
          and e.date::date <= current_date
     )
     and (
       exists (select 1 from rsvps r
                where r.event_id = p_event
                  and lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
       or exists (select 1 from tickets t
                   where t.event_id = p_event
                     and t.status <> 'void'
                     and (t.user_id = auth.uid()
                          or lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
     );
$$;

revoke all on function public.attended_event(text) from public;
grant execute on function public.attended_event(text) to authenticated;


-- ---------------------------------------------------------
-- 2. テーブル
--    イニシャルと国籍は、投稿した時点のプロフィールから写します（下のトリガー）。
--    画面から送られた値は使いません。他人の名前で投稿できないようにするためです。
-- ---------------------------------------------------------
create table if not exists event_reviews (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  initials    text not null default '',
  nationality text,
  body        text not null,
  created_at  timestamptz default now(),
  constraint event_reviews_body_check check (char_length(btrim(body)) between 2 and 1000),
  constraint event_reviews_one_per_event unique (event_id, user_id)
);

create table if not exists event_photos (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  initials    text not null default '',
  nationality text,
  path        text not null,           -- community-photos バケットの中の場所
  url         text not null,
  created_at  timestamptz default now()
);

create index if not exists event_reviews_event_idx on event_reviews (event_id, created_at desc);
create index if not exists event_photos_event_idx  on event_photos  (event_id, created_at desc);


-- ---------------------------------------------------------
-- 3. 投稿者の情報をプロフィールから写すトリガー
--    名前の頭文字（最大2文字）と国籍だけを残します。
-- ---------------------------------------------------------
create or replace function public.community_post_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p_name text;
  p_nat  text;
begin
  new.user_id := auth.uid();
  select name, nationality into p_name, p_nat from profiles where id = auth.uid();
  new.initials := upper(coalesce(
    nullif(
      left(split_part(btrim(coalesce(p_name, '')), ' ', 1), 1) ||
      left(split_part(btrim(coalesce(p_name, '')), ' ', 2), 1),
    ''),
    left(coalesce(auth.jwt() ->> 'email', '?'), 1)
  ));
  new.nationality := p_nat;
  return new;
end;
$$;

drop trigger if exists event_reviews_stamp on event_reviews;
create trigger event_reviews_stamp before insert on event_reviews
  for each row execute function public.community_post_stamp();

drop trigger if exists event_photos_stamp on event_photos;
create trigger event_photos_stamp before insert on event_photos
  for each row execute function public.community_post_stamp();


-- ---------------------------------------------------------
-- 4. 読み書きの権限
--    読むのは誰でも（サイトに公開するため）。user_id は返しません
--    （列の権限で外します）。
--    感想: 書けるのは参加した本人、消せるのは本人と管理者。
--    写真: 足すのも消すのも管理者だけ。
-- ---------------------------------------------------------
alter table event_reviews enable row level security;
alter table event_photos  enable row level security;

drop policy if exists "public read reviews" on event_reviews;
create policy "public read reviews" on event_reviews
  for select to anon, authenticated using ( true );

drop policy if exists "attendee writes review" on event_reviews;
create policy "attendee writes review" on event_reviews
  for insert to authenticated with check ( attended_event(event_id) );

drop policy if exists "owner or admin deletes review" on event_reviews;
create policy "owner or admin deletes review" on event_reviews
  for delete to authenticated using ( user_id = auth.uid() or is_admin() );

drop policy if exists "public read photos" on event_photos;
create policy "public read photos" on event_photos
  for select to anon, authenticated using ( true );

drop policy if exists "attendee adds photo" on event_photos;
drop policy if exists "admin adds photo" on event_photos;
create policy "admin adds photo" on event_photos
  for insert to authenticated with check ( is_admin() );

drop policy if exists "owner or admin deletes photo" on event_photos;
drop policy if exists "admin deletes photo" on event_photos;
create policy "admin deletes photo" on event_photos
  for delete to authenticated using ( is_admin() );

-- 誰の投稿か（user_id）は公開しません。本人の投稿かどうかは
-- 下の my_community_posts() で見分けます。
revoke select on event_reviews from anon, authenticated;
revoke select on event_photos  from anon, authenticated;
grant  select (id, event_id, initials, nationality, body, created_at) on event_reviews to anon, authenticated;
grant  select (id, event_id, initials, nationality, path, url, created_at) on event_photos to anon, authenticated;
grant  insert (event_id, body)      on event_reviews to authenticated;
grant  insert (event_id, path, url) on event_photos  to authenticated;
grant  delete on event_reviews, event_photos to authenticated;


-- 自分の投稿の id だけを返します（「消す」ボタンを自分の投稿にだけ出すため）
create or replace function public.my_community_posts(p_event text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'reviews', coalesce((select json_agg(id) from event_reviews where event_id = p_event and user_id = auth.uid()), '[]'::json),
    'photos',  coalesce((select json_agg(id) from event_photos  where event_id = p_event and user_id = auth.uid()), '[]'::json)
  );
$$;
revoke all on function public.my_community_posts(text) from public;
grant execute on function public.my_community_posts(text) to authenticated;


-- ---------------------------------------------------------
-- 5. 写真の置き場所（Storage）
--    公開バケット community-photos。置くのも消すのも管理者だけです。
--    読むのは誰でも（公開バケットなので、URL を知っていればダウンロードできます）。
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-photos', 'community-photos', true)
on conflict (id) do nothing;

drop policy if exists "member uploads own community photo" on storage.objects;
drop policy if exists "admin uploads community photo" on storage.objects;
create policy "admin uploads community photo" on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'community-photos' and is_admin() );

drop policy if exists "owner or admin deletes community photo" on storage.objects;
drop policy if exists "admin deletes community photo" on storage.objects;
create policy "admin deletes community photo" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'community-photos' and is_admin() );


-- ---------------------------------------------------------
-- 確認（流したあとに試すなら）
--   select public.attended_event('<終わった回の id>');   -- サインインした本人で true
--   select count(*) from event_reviews;
-- ---------------------------------------------------------
