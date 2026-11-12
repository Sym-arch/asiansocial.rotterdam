-- =========================================================
-- 20. 実際に来た人数（events.attendance）
--
-- 流し方: Supabase → SQL Editor に全部貼って Run。何度流しても壊れません。
--
-- なぜ:
--   予約数と「実際に来た人数」を回ごとに残して、あとで分析に使うためです。
--   受付のチェックイン（tickets.status = 'used'）からも数えられますが、
--   受付で名簿を使わなかった回や、当日の飛び入りがあった回は合いません。
--   そこで管理画面から手で入れた数を、別に持てるようにします。
--   空のときは、管理画面はチェックインの数を使って表示します。
--
--   書き換えられるのは管理者だけです（events の更新は 02 で管理者に絞ってあります）。
-- =========================================================

alter table events add column if not exists attendance int;

alter table events drop constraint if exists events_attendance_check;
alter table events add  constraint events_attendance_check check (attendance is null or attendance >= 0);
