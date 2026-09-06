-- =========================================================
-- フェーズ2 — 注文とチケット
--
-- 03-members.sql を実行済みであることが前提です。
-- Supabase の SQL Editor に全部貼り付けて実行してください。書き換え不要です。
--
-- ここではまだお金を扱いません。無料イベントだけで
-- 「発券 → チケット表示 → 入場」まで通しきるのが目的です。
-- 決済を足すのはこれが安定してからで、そうすれば
-- 決済のトラブルと発券のトラブルを切り分けられます。
--
-- orders は無料イベントも通します（total_cents = 0）。
-- 無料と有料で別の道を作ると、二重に保守することになるためです。
-- =========================================================


-- ---------------------------------------------------------
-- 1. 注文
-- ---------------------------------------------------------
create table if not exists orders (
  id                 text primary key,
  user_id            uuid references auth.users(id) on delete set null,
  email              text not null,
  name               text,
  event_id           text,               -- events への外部キーは張りません（rsvps と同じ理由）
  event_title        text,               -- イベントが消えても注文は読めるように控えます
  event_date         text,
  quantity           int  not null default 1,
  unit_price_cents   int  not null default 0,
  total_cents        int  not null default 0,
  currency           text not null default 'EUR',
  tier_at_purchase   text not null default 'guest',   -- guest / free / premium
  status             text not null default 'paid',    -- paid / refunded / cancelled
  -- 決済はフェーズ3。列だけ先に用意しておきます
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  coupon_id          text,
  discount_cents     int  not null default 0,
  created_at         timestamptz default now(),
  constraint orders_status_check check (status in ('paid', 'refunded', 'cancelled'))
);

create index if not exists orders_email_idx    on orders (lower(email));
create index if not exists orders_event_idx    on orders (event_id);
create index if not exists orders_user_idx     on orders (user_id);


-- ---------------------------------------------------------
-- 2. チケット
--
--    予約1件につき1枚。3名予約なら「3名」と書かれた1枚です。
--    3人分の名前を集めるのは導線が長くなりすぎるためで、
--    転送されても受付は quantity 人しか通しません。
-- ---------------------------------------------------------
create table if not exists tickets (
  id            text primary key,
  order_id      text references orders(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  email         text not null,
  event_id      text,
  event_title   text,
  event_date    text,
  holder_name   text not null,
  quantity      int  not null default 1,
  -- 表には出しません。チケットURLの推測を防ぐための長い乱数です
  secret        text not null,
  status        text not null default 'valid',   -- valid / used / void
  checked_in_at timestamptz,
  checked_in_by text,
  created_at    timestamptz default now(),
  constraint tickets_status_check check (status in ('valid', 'used', 'void'))
);

create index if not exists tickets_secret_idx on tickets (secret);
create index if not exists tickets_event_idx  on tickets (event_id, status);
create index if not exists tickets_email_idx  on tickets (lower(email));


-- ---------------------------------------------------------
-- 3. チケットの履歴
--    譲渡・振替・受付での手動通過を残します。
--    当日もめたときに「何が起きたか」を言えるようにするためです。
-- ---------------------------------------------------------
create table if not exists ticket_history (
  id         bigserial primary key,
  ticket_id  text references tickets(id) on delete cascade,
  action     text not null,      -- issued / checked_in / override / transferred / moved / voided
  detail     jsonb,
  at         timestamptz default now(),
  by_email   text
);

create index if not exists ticket_history_ticket_idx on ticket_history (ticket_id, at desc);


-- ---------------------------------------------------------
-- 4. チケットを1回だけ消し込む
--
--    「読んでから書く」を2文に分けると、2台の端末で同時にスキャンした
--    ときに両方通ってしまいます。where に status を含めた1文の更新に
--    すれば、必ず片方だけが0行を返します。
--
--    security definer なのは、チケットの持ち主がログインしていなくても
--    （メールのリンクだけで）入場できるようにするためです。
--    引数の secret を知っている人だけが通せます。
-- ---------------------------------------------------------
create or replace function public.check_in_ticket(p_secret text)
returns table (ok boolean, reason text, holder text, qty int, at_time timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket tickets%rowtype;
begin
  update tickets
     set status = 'used', checked_in_at = now(), checked_in_by = 'self'
   where secret = p_secret and status = 'valid'
  returning * into v_ticket;

  if found then
    insert into ticket_history (ticket_id, action, detail)
    values (v_ticket.id, 'checked_in', jsonb_build_object('quantity', v_ticket.quantity));
    return query select true, 'ok'::text, v_ticket.holder_name, v_ticket.quantity, v_ticket.checked_in_at;
    return;
  end if;

  -- 通らなかった理由を返します（すでに入場済みなら、その時刻も）
  select * into v_ticket from tickets where secret = p_secret;
  if not found then
    return query select false, 'not_found'::text, null::text, null::int, null::timestamptz;
  else
    return query select false, v_ticket.status, v_ticket.holder_name, v_ticket.quantity, v_ticket.checked_in_at;
  end if;
end;
$$;

grant execute on function public.check_in_ticket(text) to anon, authenticated;


-- ---------------------------------------------------------
-- 5. secret だけでチケットを読む
--    メールのリンクから、ログインなしで自分のチケットを開けるようにします。
--    当日の入口でログインを求めるのは現実的ではないためです。
-- ---------------------------------------------------------
create or replace function public.get_ticket(p_secret text)
returns table (
  id text, event_id text, event_title text, event_date text,
  holder_name text, quantity int, status text, checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.event_id, t.event_title, t.event_date,
         t.holder_name, t.quantity, t.status, t.checked_in_at
    from tickets t
   where t.secret = p_secret;
$$;

grant execute on function public.get_ticket(text) to anon, authenticated;


-- ---------------------------------------------------------
-- 6. 読み書きの制限
-- ---------------------------------------------------------
alter table orders        enable row level security;
alter table tickets       enable row level security;
alter table ticket_history enable row level security;

-- 訪問者は注文とチケットを「作れる」（アカウント無しでも予約できるため）
drop policy if exists "anyone insert orders" on orders;
create policy "anyone insert orders" on orders
  for insert to anon, authenticated with check ( true );

drop policy if exists "anyone insert tickets" on tickets;
create policy "anyone insert tickets" on tickets
  for insert to anon, authenticated with check ( true );

-- 本人は自分のぶんだけ読める（メールアドレスで突き合わせ）
drop policy if exists "read own orders" on orders;
create policy "read own orders" on orders
  for select to authenticated
  using ( lower(email) = lower(auth.jwt() ->> 'email') );

drop policy if exists "read own tickets" on tickets;
create policy "read own tickets" on tickets
  for select to authenticated
  using ( lower(email) = lower(auth.jwt() ->> 'email') );

-- 管理者は全部
drop policy if exists "admin all orders" on orders;
create policy "admin all orders" on orders
  for all to authenticated using ( is_admin() ) with check ( is_admin() );

drop policy if exists "admin all tickets" on tickets;
create policy "admin all tickets" on tickets
  for all to authenticated using ( is_admin() ) with check ( is_admin() );

drop policy if exists "admin read history" on ticket_history;
create policy "admin read history" on ticket_history
  for select to authenticated using ( is_admin() );

-- secret は誰にも SELECT させません。チケットの取得は get_ticket() 経由だけです。
revoke select on tickets from anon, authenticated;
grant  select (id, order_id, user_id, email, event_id, event_title, event_date,
               holder_name, quantity, status, checked_in_at, created_at)
  on tickets to authenticated;


-- =========================================================
-- 実行後の確認
--
--   select count(*) from orders;    -- 0
--   select count(*) from tickets;   -- 0
--   select * from check_in_ticket('nonexistent');   -- ok=false, reason='not_found'
--
-- rsvps テーブルはまだ残します。既存の予約が入っているので、
-- 新しい予約が orders / tickets に流れることを確認してから移行します。
-- =========================================================
