-- Supabase SQL Editor에서 실행.
-- rank_run_records: 유저(user_id)당 총점(score_total) 상위 10건만 유지 (동점 시 최근 played_at 우선).

-- 기존 데이터 정리 (11건째부터 삭제)
delete from public.rank_run_records
where id in (
	select id
	from (
		select
			id,
			row_number() over (
				partition by user_id
				order by score_total desc, played_at desc
			) as rn
		from public.rank_run_records
	) t
	where t.rn > 10
);

-- 삽입 후 초과분 제거
create or replace function public.trg_trim_rank_run_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	delete from public.rank_run_records
	where id in (
		select id
		from (
			select
				id,
				row_number() over (
					partition by user_id
					order by score_total desc, played_at desc
				) as rn
			from public.rank_run_records
			where user_id = new.user_id
		) ranked
		where ranked.rn > 10
	);
	return new;
end;
$$;

drop trigger if exists trim_rank_after_insert on public.rank_run_records;

create trigger trim_rank_after_insert
	after insert on public.rank_run_records
	for each row
execute procedure public.trg_trim_rank_run_records();

comment on function public.trg_trim_rank_run_records() is
	'Keeps at most 10 rank rows per user_id (best score_total, then played_at).';
