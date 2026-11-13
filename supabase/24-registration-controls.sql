/* 24-registration-controls.sql
   - 管理画面から「募集を締め切る」をイベントごとに手動で切り替えられるようにする
   - アーリーバードを、期日だけでなく人数の上限でも終われるようにする
*/

alter table events add column if not exists registration_closed boolean not null default false;
alter table events add column if not exists early_bird_limit integer;

/* 締め切ったイベントには、以後 RSVP を追加できないようにする（無料予約の最終防衛線） */
drop policy if exists "anyone insert rsvps" on rsvps;
drop policy if exists "anon insert rsvps"   on rsvps;
create policy "anyone insert rsvps" on rsvps
  for insert to anon, authenticated with check (
    not exists (
      select 1 from events e
      where e.id = event_id and e.registration_closed = true
    )
  );
