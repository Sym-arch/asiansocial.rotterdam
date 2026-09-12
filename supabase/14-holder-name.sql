-- =========================================================
-- 券面の名前を、本人の名前に揃えます
--
-- なぜ要るのか:
--   以前は、名前を登録していない人の予約に、名前の代わりに
--   メールアドレスを入れていました。そのため古いチケットの券面や
--   当日の受付名簿に、アドレスがそのまま大きく出ています。
--
--   予約・チケット・注文は本人が更新できません（更新できると、
--   他人の券面を書き換えられてしまいます）。そこで「サインイン中の
--   本人のアドレスと一致する行だけ」を書き換える関数を用意します。
--
--   security definer なので関数の中では制限を越えられますが、
--   触れるのは auth.jwt() のメールアドレスと一致する行だけです。
-- =========================================================

create or replace function public.set_my_name(p_name text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name  text := nullif(btrim(p_name), '');
  v_total integer := 0;
  v_rows  integer;
begin
  -- サインインしていない、または名前が空なら何もしません
  if v_email = '' or v_name is null then
    return 0;
  end if;

  update tickets set holder_name = v_name
   where lower(email) = v_email
     and coalesce(holder_name, '') is distinct from v_name;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  update rsvps set name = v_name
   where lower(email) = v_email
     and coalesce(name, '') is distinct from v_name;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  update orders set name = v_name
   where lower(email) = v_email
     and coalesce(name, '') is distinct from v_name;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  return v_total;
end;
$$;

revoke all on function public.set_my_name(text) from public;
grant execute on function public.set_my_name(text) to authenticated;

-- 確認: サインインした状態で実行すると、書き換えた行数が返ります
-- select public.set_my_name('Taiyo Iino');
-- select holder_name, email from tickets order by created_at desc limit 5;
