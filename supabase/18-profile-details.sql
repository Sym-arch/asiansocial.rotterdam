-- =========================================================
-- 18. プロフィールの任意項目（国籍・住んでいる都市・生年月日）
--
-- 流し方: Supabase → SQL Editor に全部貼って Run。何度流しても壊れません。
--
-- なぜ:
--   どの国の人が、どの街から来ているかを知って、次の開催地や
--   テーマを決めるためです。全部任意で、答えなくても何も変わりません。
--   サイト側は、この SQL を流すまで入力欄を出しません
--   （列が無いのに保存ボタンだけ出ると、押しても失敗するため）。
-- =========================================================

-- ---------------------------------------------------------
-- 1. 列を足す
--    国籍は1つ。ISO の2文字コードで持ちます（'JP' 'KR' など）。
--    名前で持つと、言語ごとに表記が揺れて集計できません。
--    都市も表示用の文字ではなく、決まった値で持ちます。
-- ---------------------------------------------------------
alter table profiles add column if not exists nationality text;
alter table profiles add column if not exists city        text;
alter table profiles add column if not exists birthdate   date;

alter table profiles drop constraint if exists profiles_nationality_check;
alter table profiles add  constraint profiles_nationality_check check (
  nationality is null or nationality ~ '^[A-Z]{2}$'
);

alter table profiles drop constraint if exists profiles_city_check;
alter table profiles add  constraint profiles_city_check check (
  city is null or city in ('rotterdam', 'amsterdam', 'the-hague', 'utrecht', 'other-nl', 'abroad')
);

-- 未来の日付や、ありえない古さの日付を弾きます。
-- 年齢の下限（16歳）は画面側で見ています。DB の check に今日の日付を
-- 使うと、日がたつにつれて意味が変わってしまうためです。
alter table profiles drop constraint if exists profiles_birthdate_check;
alter table profiles add  constraint profiles_birthdate_check check (
  birthdate is null or (birthdate >= date '1900-01-01' and birthdate <= date '2030-01-01')
);


-- ---------------------------------------------------------
-- 2. 本人が書き換えられる列に足す
--    03 で「本人が触れる列は name と locale だけ」に絞ってあります。
--    同じ考えで、この3列だけを追加で開けます。
-- ---------------------------------------------------------
grant update (nationality, city, birthdate) on profiles to authenticated;


-- ---------------------------------------------------------
-- 確認（流したあとに試すなら）
--   select column_name from information_schema.columns
--    where table_name = 'profiles' and column_name in ('nationality','city','birthdate');
-- ---------------------------------------------------------
