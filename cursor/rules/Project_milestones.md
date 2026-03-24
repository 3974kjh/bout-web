# Project_milestones.md

## Phase 1 — 싱글 전투 코어 (현재)
- [ ] Phaser 기본 씬 구성 (Boot → Preload → Battle)
- [ ] Mech 이동/점프/기본공격
- [ ] 적 AI 상태머신 (idle → chase → attack → stun)
- [ ] 충돌 판정 + HP 시스템
- [ ] 변신 게이지 + 변신 로직 (TransformSystem)
- [ ] 파츠 조합 스탯 계산 (PartsSystem)
- [ ] Svelte HUD (HP바, 변신게이지)

**완료 기준**: 행성전 1스테이지 클리어 가능

---

## Phase 2 — UI / 메뉴
- [ ] 로그인 화면
- [ ] 대기 메인 화면 (로비)
- [ ] 방 대기 화면
- [ ] 상점 화면
- [ ] 모달 3종 (방 생성 / 유저 정보 / 환경설정)
- [ ] 다크모드 토글 (CSS 변수 기반)

---

## Phase 3 — Supabase 멀티 (예정)
> 구현 전 Supabase 스키마를 API.md / Multiplayer.md에 먼저 정의할 것

- [ ] 인증 (이메일/OAuth)
- [ ] 방 생성·입장 (rooms 테이블)
- [ ] 실시간 대전 (최소 상태 동기화: 위치/HP)
- [ ] 채팅 (별도 테이블·채널, 게임 상태와 분리)
- [ ] 랭킹 (DB + RLS)

---

## 현재 스프린트
**Phase 1 — Phaser 씬 구성 + Mech 기본 이동**
