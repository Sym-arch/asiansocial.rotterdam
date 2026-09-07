-- =========================================================
-- 自分のチケットを自分で開けるようにします
--
-- 04-tickets.sql を実行済みであることが前提です。
-- Supabase の SQL Editor に貼って実行してください。
--
-- なぜ要るのか:
--   tickets の secret は列の権限から外してあります。誰でも一覧できると
--   URL が推測できてしまうためです。ただしそのままだと、買った本人も
--   マイページから自分のチケットを開けません。
--
--   そこで「自分の分だけ」を返す関数を用意します。security definer なので
--   関数の中では列の制限を越えられますが、返すのは auth.uid() が一致する
--   行か、サインイン中のメールアドレスと同じ行だけです。
--
--   メールでも引くのは、決済で自動作成されたアカウントと
--   予約時のアドレスが同じで user_id が入らなかった回を拾うためです。
-- =========================================================

create or replace function public.my_tickets()
returns table (
  id text, event_id text, event_title text, event_date text,
  holder_name text, quantity int, status text, checked_in_at timestamptz,
  secret text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.event_id, t.event_title, t.event_date,
         t.holder_name, t.quantity, t.status, t.checked_in_at,
         t.secret, t.created_at
    from tickets t
   where auth.uid() is not null
     and (
       t.user_id = auth.uid()
       or lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     )
   order by t.created_at desc;
$$;

-- サインインしている人だけが呼べます。anon には渡しません。
revoke all on function public.my_tickets() from public;
grant execute on function public.my_tickets() to authenticated;

-- 確認: サインインした状態で実行すると自分の分だけが返ります
-- select * from public.my_tickets();
