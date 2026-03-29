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
- [x] 자동 미사일 + 업그레이드(`PlayerUpgrades`) — 적 히트는 구형 판정 + XZ 셀 버킷 광역
- [x] EXP 조각 — `ExpShardManager`(`InstancedMesh`) 수집 → `LevelSystem`; 풀 초과 시 즉시 `addExp`
- [x] 레벨업 / 필드 보급 — 카드 3선택 1 (`UpgradeSystem` + `HudOverlay` 모달)
- [x] 몬스터 근접/원거리·보스 AOE (`Monster`, `GameEngine` AOE 처리)
- [x] `CombatSystem` — 몬스터→플레이어 데미지, 접촉 데미지
- [x] 데미지 부유 숫자(`DamageNumbers` + `damage-number` 이벤트) — 동시 개수 상한·GC 완화
- [x] 연속 처치 → 오버드라이브 버스트

### 웨이브·보스
- [x] `WaveSystem` — 잡몹 주기 스폰, 동시 생존 상한·밀집 시 스폰 간격 완화, 난이도 파라미터
- [x] 보스 주기 스폰(겹침 허용), 5종 동물 보스 로테이션 + AOE
- [x] 보스 격파 시 HP 회복·난이도 테마 반영 등 (`onBossDefeated`)

### 오디오·성능(코어)
- [x] 효과음 `sfx.ts` — `Audio` 풀링 + 고빈도 이벤트 스로틀
- [x] 상기 웨이브/경험치/투사체/분리/몬스터 시각 LOD 등 프레임 비용 완화 (`Architecture.md` 표 참고)

### HUD·UI
- [x] `HudOverlay` — HP, EXP, 레벨, 진화 프리뷰, 획득 카드 그리드, 미니맵, 킬 통계, 보스/오버드라이브 배너
- [x] 게임 오버 — 보스 타입별·일반 처치·가중 점수 (`computeRunScore`)
- [x] ESC 일시정지, 재시작(`restart-game`)

### 기타
- [x] `EventBus` 계약 정리 — **`API.md` 단일 소스**
- [ ] 레거시 파일(`TransformSystem`, `HealthItem` 등) 정리 또는 재연결 여부 결정

---

## Phase 2 — 메뉴·메타 진척 (일부 반영됨)

- [x] **정비소** `/shop` — 기체(`MechBase`)·미사일 스킨·선호 카드, `shopIndexedDb` 영속화; `ShopMechPreview` / `ShopEvolutionGuide` Three 미리보기(스키닝 GLTF 로드 중 로딩 UI)
- [x] **랭킹** `/rank` — 로컬 기록(`rankIndexedDb`)·시상대·목록
- [x] 랜딩 **음량·효과음** 모달(`AudioSettingsModal`)
- [ ] 메인에서 종족/로드아웃 심화 선택 → 스탯 반영(현재는 정비소 기체 선택으로 대체)
- [ ] 파츠 UI 및 `PartsSystem` 심화
- [ ] 스테이지/난이도 선택, 결과 화면 공유용 요약
- [ ] 조작 안내 확장(인게임 전용 도움말 등)

---

## Phase 3 — Supabase 멀티 (예정)

- [ ] `API.md`에 스키마·Realtime 채널 확정 후 구현
- [ ] 방 생성/입장, 최소 상태 동기화, 채팅(선택)

---

## 현재 스프린트 메모

**코어 루프·정비소·랭킹·문서가 실제 코드와 일치하도록 유지한다.** 구 구현은 문서에서 제거하고, `GameEngine`·라우트·스토리지 경로를 단일 기준으로 삼는다.
