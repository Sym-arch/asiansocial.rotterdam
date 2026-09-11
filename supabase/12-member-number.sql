-- =========================================================
-- 会員番号（No. 0001 から登録順）
--
-- 名前は自己申告なので、本人確認には使えません。重ならない番号を
-- 会員証と受付名簿の両方に出して、「番号は？」で確かめられるようにします。
--
-- 番号は memberships に持たせます。本人は memberships を更新できない
-- （03-members.sql で revoke 済み）ので、自分で書き換えられません。
-- 何度実行しても同じ結果になります。
-- =========================================================

alter table memberships add column if not exists member_no integer;

-- すでにいる会員は登録した順に番号を振ります
with ordered as (
  select user_id,
         row_number() over (order by started_at nulls last, created_at, user_id) as n
  from memberships
  where member_no is null
)
update memberships m
   set member_no = o.n + coalesce((select max(member_no) from memberships), 0)
  from ordered o
 where m.user_id = o.user_id;

-- これから登録する人には、続きの番号が自動で付きます
create sequence if not exists memberships_member_no_seq owned by memberships.member_no;
select setval('memberships_member_no_seq',
              greatest(coalesce((select max(member_no) from memberships), 0), 1),
              (select max(member_no) from memberships) is not null);
alter table memberships alter column member_no set default nextval('memberships_member_no_seq');
alter table memberships alter column member_no set not null;

create unique index if not exists memberships_member_no_key on memberships (member_no);

-- 確認: 登録順に 1, 2, 3 … と並んでいれば成功です
-- select m.member_no, p.email, m.started_at
--   from memberships m join profiles p on p.id = m.user_id
--  order by m.member_no;
