-- =========================================================
-- イベントを消したら、その予約も一緒に片付けます
--
-- Supabase の SQL Editor に貼って実行してください。
-- 何度実行しても同じ結果になります。
--
-- なぜ要るのか:
--   rsvps と tickets は events への外部キーを張っていません。
--   予約が「イベントが未登録」を理由に弾かれて失われるより、
--   参照が浮くほうが害が小さいと判断したためです。
--
--   ただし副作用がありました。イベントを消しても予約が残るので、
--   マイページに「もう無い回」の予約が並び続けます。
--
--   外部キーを張り直すのではなく、消えたときだけ後始末をします。
--   予約を作る側の緩さは保ったまま、消す側だけ揃えられます。
--
-- チケットは消さずに「無効」にします。
--   お金が動いた記録は残す必要があるためです。
--   受付名簿（rsvps）からは消します。当日通す人の一覧なので、
--   開催しない回の行が残っていると邪魔になります。
-- =========================================================


-- ---------------------------------------------------------
-- 1. 後始末の中身
-- ---------------------------------------------------------
create or replace function public.cleanup_deleted_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from rsvps where event_id = old.id;

  update tickets
     set status = 'void'
   where event_id = old.id
     and status <> 'used';          -- 当日通した記録は書き換えません

  update orders
     set status = 'cancelled'
   where event_id = old.id
     and status = 'paid';

  return old;
end;
$$;


-- ---------------------------------------------------------
-- 2. イベントが消えたら自動で走らせます
--    管理画面からでも、Supabase の画面から消しても効きます。
-- ---------------------------------------------------------
drop trigger if exists events_cleanup on events;

create trigger events_cleanup
  after delete on events
  for each row
  execute function public.cleanup_deleted_event();


-- ---------------------------------------------------------
-- 3. すでに浮いてしまっている行の片付け
--    仕組みを入れる前に消したイベントのぶんです。
-- ---------------------------------------------------------
delete from rsvps r
 where r.event_id is not null
   and not exists (select 1 from events e where e.id = r.event_id);

update tickets tk
   set status = 'void'
 where tk.event_id is not null
   and tk.status = 'valid'
   and not exists (select 1 from events e where e.id = tk.event_id);

update orders o
   set status = 'cancelled'
 where o.event_id is not null
   and o.status = 'paid'
   and not exists (select 1 from events e where e.id = o.event_id);


-- 確認: 0 行なら浮いた予約は残っていません
select count(*) as orphan_rsvps
  from rsvps r
 where r.event_id is not null
   and not exists (select 1 from events e where e.id = r.event_id);
