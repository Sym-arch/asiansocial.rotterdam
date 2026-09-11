-- =========================================================
-- 新しいイベントのお知らせメール
--
--   profiles.news_opt_in     … お知らせを受け取るか（本人がプロフィールで切り替え）
--   events.announced_at      … そのイベントを最後に会員へ送った日時
--   events.announced_count   … そのとき何人に届いたか
--
-- 既存の会員も「受け取る」から始まります。どのメールにも配信停止の
-- リンクが付き、プロフィールからも止められます。
-- 何度実行しても同じ結果になります。
-- =========================================================

alter table profiles add column if not exists news_opt_in boolean not null default true;

-- 本人が変えられる列に加えます（03-members.sql では name と locale だけでした）
grant update (name, locale, news_opt_in) on profiles to authenticated;

alter table events add column if not exists announced_at    timestamptz;
alter table events add column if not exists announced_count integer;

-- 確認: お知らせを受け取る会員の数
-- select count(*) from profiles where news_opt_in;
