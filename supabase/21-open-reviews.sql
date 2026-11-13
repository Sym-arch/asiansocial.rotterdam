-- =========================================================
-- 21. 感想の投稿を「参加した人だけ」から「サインインした人なら誰でも」に広げる
--
-- 流し方: Supabase → SQL Editor に全部貼って Run。何度流しても壊れません。
--
-- 決めごと（本人と相談済み）:
--   - これまでは、その回に参加した人（予約かチケットがある会員）だけが
--     感想を書けました。これからは、サインインしていれば誰でも書けます。
--   - 写真の追加・削除は今までどおり管理者だけです（ここでは変えません）。
--   - 1イベント1人1件までの制限（event_reviews_one_per_event）はそのままです。
-- =========================================================

drop policy if exists "attendee writes review" on event_reviews;
drop policy if exists "member writes review" on event_reviews;
create policy "member writes review" on event_reviews
  for insert to authenticated with check ( true );

-- 確認（流したあとに試すなら）
--   select policyname, cmd from pg_policies where tablename = 'event_reviews';
