# Project_milestones.md

## Phase 1 — 싱글 3D 서바이벌 코어 (진행 중 / 지속 개선)

### 런타임·월드
- [x] Three.js 씬·카메라·조명·리사이즈
- [x] `TrainingPlanet` — 넓은 플레이 공간, 플랫폼·충돌·발판 루트(포션/카드 스폰 포인트)
- [x] 생존 시간 누적 및 HUD 표시

### 플레이어
- [x] WASD 이동, Space/C 점프
- [x] Shift 대쉬 (쿨다운, 업그레이드로 단축 가능) — 머리 위 스프라이트 HUD에 표시
- [x] Lv10+ 2단 점프, form7+ 공중 길게 누르기 글라이드 (`GameConfig` 상수)
- [x] 레벨 연동 메카 진화 모델(`MechModel.formForLevel` / `Player.setLevel`)

### 전투·성장
- [x] 자동 미사일 + 업그레이드(`PlayerUpgrades`)
- [x] EXP 조각(`ExpShard`) 수집 → `LevelSystem`
- [x] 레벨업 / 필드 보급 — 카드 3선택 1 (`UpgradeSystem` + `HudOverlay` 모달)
- [x] 몬스터 근접/원거리·보스 AOE (`Monster`, `GameEngine` AOE 처리)
- [x] `CombatSystem` — 몬스터→플레이어 데미지, 접촉 데미지
- [x] 데미지 부유 숫자(`DamageNumbers` + `damage-number` 이벤트)
- [x] 연속 처치 → 오버드라이브 버스트

### 웨이브·보스
- [x] `WaveSystem` — 잡몹 주기 스폰, 난이도 완화/강화 파라미터
- [x] 보스 주기 스폰(겹침 허용), 5종 동물 보스 로테이션 + AOE
- [x] 보스 격파 시 HP 회복·난이도 테마 반영 등 (`onBossDefeated`)

### HUD·UI
- [x] `HudOverlay` — HP, EXP, 레벨, 진화 프리뷰, 획득 카드 그리드, 미니맵, 킬 통계, 보스/오버드라이브 배너
- [x] 게임 오버 — 보스 타입별·일반 처치·가중 점수 (`computeRunScore`)
- [x] ESC 일시정지, 재시작(`restart-game`)

### 기타
- [x] `EventBus` 계약 정리 — **`API.md` 단일 소스**
- [ ] 레거시 파일(`TransformSystem`, `HealthItem` 등) 정리 또는 재연결 여부 결정

---

## Phase 2 — 메뉴·메타 진척 (예정)

- [ ] 메인 메뉴에서 종족/로드아웃 선택 → 스탯 반영
- [ ] 파츠 UI 및 `PartsSystem` 심화
- [ ] 스테이지/난이도 선택, 결과 화면 공유용 요약
- [ ] 조작 안내·설정(음량·감도 등)

---

## Phase 3 — Supabase 멀티 (예정)

- [ ] `API.md`에 스키마·Realtime 채널 확정 후 구현
- [ ] 방 생성/입장, 최소 상태 동기화, 채팅(선택)

---

## 현재 스프린트 메모

**코어 루프 안정화 + 문서·랜딩 정합성 유지.** 구 구현(근접 4콤보·변신 HUD 등)은 문서에서 제거하고, 실제 코드 기준으로만 기술한다.
