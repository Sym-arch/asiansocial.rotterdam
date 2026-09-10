-- =========================================================
-- 「そのメールアドレスの会員が居るか」だけを答える関数
--
-- Supabase の SQL Editor に貼って実行してください。
--
-- なぜ要るのか:
--   パスワードを忘れた画面で、登録の無いアドレスを入れても
--   これまでは「送りました」と出ていました。打ち間違いに気づけません。
--   auth.users は PostgREST から触れないので、真偽だけ返す関数を開けます。
--
-- 承知しておくこと:
--   これは「そのアドレスが会員かどうか」を外から確かめられる、
--   ということでもあります（アカウント列挙）。総当たりで
--   会員名簿を作られる余地が生まれます。
--   使い勝手を優先してこの形にしています。やめる場合は、
--   この関数を落として core.js の accountExists を常に true に
--   すれば、以前の「登録があれば送ります」に戻ります。
--
--   返すのは真偽値だけです。名前も、登録日も、他の情報も出しません。
-- =========================================================

create or replace function public.account_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
     where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.account_exists(text) from public;
grant execute on function public.account_exists(text) to anon, authenticated;

-- 確認
-- select public.account_exists('t.iino@sym-arch.com');   -- true
-- select public.account_exists('nobody@example.com');    -- false
