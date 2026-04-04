-- Supabase SQL Editor에서 실행.
-- 로그인한 사용자(auth.uid())의 세계 순위(유저별 베스트 1건 기준)를 반환. 미참여 시 NULL.

create or replace function public.get_my_world_rank()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
	with best_per_user as (
		select distinct on (r.user_id)
			r.user_id,
			r.score_total,
			r.played_at
		from public.rank_run_records r
		order by r.user_id, r.score_total desc, r.played_at desc
	),
	ranked as (
		select
			user_id,
			row_number() over (order by score_total desc, played_at desc) as place
		from best_per_user
	)
	select place::bigint
	from ranked
	where user_id = auth.uid();
$$;

comment on function public.get_my_world_rank() is
	'Global place (1-based) for current user; same ordering as get_world_leaderboard.';

grant execute on function public.get_my_world_rank() to authenticated;
