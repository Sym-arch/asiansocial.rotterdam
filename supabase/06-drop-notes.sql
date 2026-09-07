-- =========================================================
-- ブログ（notes）をやめます
--
-- 実行すると記事は戻りません。消す前に、残しておきたい記事が
-- 無いか確認してください。中身を控えたいときは、消す前に
-- Table Editor の Export で CSV を落としておいてください。
--
-- Supabase のダッシュボード → SQL Editor に貼って実行します。
-- 何度実行しても同じ結果になります（すでに無ければ何もしません）。
-- =========================================================

-- ポリシーはテーブルと一緒に消えますが、
-- 先に落としておくと「何が付いていたか」がログに残ります。
drop policy if exists "public read notes"  on notes;
drop policy if exists "anon write notes"   on notes;
drop policy if exists "anon update notes"  on notes;
drop policy if exists "anon delete notes"  on notes;
drop policy if exists "admin write notes"  on notes;
drop policy if exists "admin update notes" on notes;
drop policy if exists "admin delete notes" on notes;

drop table if exists notes;

-- 確認: 0 行なら消えています
select count(*) as notes_left
from information_schema.tables
where table_schema = 'public' and table_name = 'notes';
