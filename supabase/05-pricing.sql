-- =========================================================
-- フェーズ3 — 価格
--
-- 04-tickets.sql を実行済みであることが前提です。
-- Supabase の SQL Editor に全部貼り付けて実行してください。書き換え不要です。
--
-- 金額はすべて「セント」の整数で持ちます。12.50 を小数で持つと
-- どこかで必ず1セントずれるためです。表示するときだけ割ります。
--
-- 既存の price 列（'€5' のような文字列）はそのまま残します。
-- 以前に作ったイベントの表示が壊れないようにするためで、
-- 新しい計算はすべて price_cents 側で行います。
-- =========================================================


-- ---------------------------------------------------------
-- 1. 通常価格
--    0 は無料。無料と有料で別の道を作らず、同じ流れを通します。
-- ---------------------------------------------------------
alter table events add column if not exists price_cents int  not null default 0;
alter table events add column if not exists currency    text not null default 'EUR';


-- ---------------------------------------------------------
-- 2. 会員割引
--    チェックが入っているときだけ会員価格を出します。
--    入っていなければ、会員も非会員も通常価格です。
-- ---------------------------------------------------------
alter table events add column if not exists member_discount     boolean not null default false;
alter table events add column if not exists price_member_cents  int;


-- ---------------------------------------------------------
-- 3. 早割
--    期限が要ります。期限のない「早割」は早割ではないためです。
-- ---------------------------------------------------------
alter table events add column if not exists early_bird       boolean not null default false;
alter table events add column if not exists price_early_cents int;
alter table events add column if not exists early_bird_until  date;


-- ---------------------------------------------------------
-- 4. 定員
--    画面には出しませんが、満席の判定に使います。
-- ---------------------------------------------------------
alter table events add column if not exists capacity int;


-- ---------------------------------------------------------
-- 5. 値の整合性
--    「割引にチェックが入っているのに金額が空」を防ぎます。
--    空のまま保存されると、表示側でどう出すか決められません。
-- ---------------------------------------------------------
alter table events drop constraint if exists events_member_price_check;
alter table events add  constraint events_member_price_check
  check ( member_discount = false or price_member_cents is not null );

alter table events drop constraint if exists events_early_price_check;
alter table events add  constraint events_early_price_check
  check ( early_bird = false or (price_early_cents is not null and early_bird_until is not null) );

alter table events drop constraint if exists events_price_positive_check;
alter table events add  constraint events_price_positive_check
  check ( price_cents >= 0
          and (price_member_cents is null or price_member_cents >= 0)
          and (price_early_cents  is null or price_early_cents  >= 0) );


-- ---------------------------------------------------------
-- 6. 既存イベントの価格を引き継ぐ
--    price は '€5' のような自由入力なので、数字だけ拾います。
--    拾えないものは 0（無料）のままにして、Admin で直す前提です。
-- ---------------------------------------------------------
update events
   set price_cents = round(
         (regexp_replace(replace(price, ',', '.'), '[^0-9.]', '', 'g'))::numeric * 100
       )::int
 where price_cents = 0
   and price is not null
   and regexp_replace(replace(price, ',', '.'), '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$';


-- =========================================================
-- 実行後の確認
--
--   select id, title, price, price_cents, currency,
--          member_discount, price_member_cents,
--          early_bird, price_early_cents, early_bird_until
--     from events order by date;
--
-- 先行販売（会員に先に案内する）は列を足していません。
-- 「ミートアップより早く募集を出す」という運用の話であって、
-- システム側で作り分ける必要がないためです。
-- =========================================================
