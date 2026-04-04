-- Supabase SQL Editor에서 한 번에 실행하세요.
-- 이전 버전과 반환 형식이 다르면 CREATE OR REPLACE 만으로는 실패할 수 있어, 먼저 DROP 합니다.

drop function if exists public.get_world_leaderboard(integer);

-- 유저별 최고 점수 1건 + auth.users (플랫폼·로그인·아바타)
-- auth 스키마 접근: search_path 에 auth 포함 + SECURITY DEFINER
create or replace function public.get_world_leaderboard(p_limit integer default 100)
returns table (
	place bigint,
	user_id uuid,
	run_id uuid,
	score_total integer,
	played_at timestamptz,
	mech_base text,
	level integer,
	survival_time integer,
	score_boss integer,
	score_level integer,
	score_time integer,
	normal_kills integer,
	boss_count integer,
	auth_provider text,
	login_id text,
	avatar_url text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
	return query
	with best_per_user as (
		select distinct on (r.user_id)
			r.user_id,
			r.id as run_id,
			r.score_total,
			r.played_at,
			r.mech_base,
			r.level,
			r.survival_time,
			r.score_boss,
			r.score_level,
			r.score_time,
			r.normal_kills,
			r.boss_count
		from public.rank_run_records r
		order by r.user_id, r.score_total desc, r.played_at desc
	),
	ranked as (
		select
			row_number() over (order by b.score_total desc, b.played_at desc)::bigint as place,
			b.user_id,
			b.run_id,
			b.score_total::integer,
			b.played_at,
			b.mech_base,
			b.level::integer,
			b.survival_time::integer,
			b.score_boss::integer,
			b.score_level::integer,
			b.score_time::integer,
			b.normal_kills::integer,
			b.boss_count::integer,
			coalesce(nullif(trim(u.raw_app_meta_data->>'provider'), ''), '') as auth_provider,
			coalesce(
				nullif(trim(u.email), ''),
				nullif(trim(u.raw_user_meta_data->>'email'), ''),
				nullif(trim(u.raw_user_meta_data->>'preferred_username'), ''),
				nullif(trim(u.raw_user_meta_data->>'user_name'), ''),
				nullif(trim(u.raw_user_meta_data->>'login'), ''),
				nullif(trim(u.raw_user_meta_data->>'name'), ''),
				nullif(trim(u.id::text), ''),
				b.user_id::text
			) as login_id,
			case
				when u.id is null then null::text
				else nullif(
					trim(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')),
					''
				)
			end as avatar_url
		from best_per_user b
		left join auth.users u on u.id = b.user_id
	)
	select
		ranked.place,
		ranked.user_id,
		ranked.run_id,
		ranked.score_total,
		ranked.played_at,
		ranked.mech_base,
		ranked.level,
		ranked.survival_time,
		ranked.score_boss,
		ranked.score_level,
		ranked.score_time,
		ranked.normal_kills,
		ranked.boss_count,
		ranked.auth_provider,
		ranked.login_id,
		ranked.avatar_url
	from ranked
	order by ranked.place
	limit greatest(1, least(coalesce(p_limit, 100), 100));
end;
$$;

comment on function public.get_world_leaderboard(integer) is
	'World leaderboard: best run per user; joins auth.users for provider, login_id, avatar.';

grant execute on function public.get_world_leaderboard(integer) to anon, authenticated;
