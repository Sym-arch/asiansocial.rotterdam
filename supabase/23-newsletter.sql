-- =========================================================
-- 23. 会員への案内メール（配信停止つき）
--
-- 流し方: Supabase → SQL Editor に全部貼って Run。何度流しても壊れません。
--
-- 今後のイベントを会員に知らせるメール（/api/newsletter）のための列です。
-- 配信を止めたい人は、メール内のリンクから自分で外せます
-- （/api/unsubscribe、サインイン不要・署名付きリンクなので他人を外せません）。
-- =========================================================

alter table profiles add column if not exists marketing_opt_out boolean not null default false;

-- 本人は自分の分だけ更新できます（名前などと同じ列単位の権限に、この列も足します）
grant update (marketing_opt_out) on profiles to authenticated;
