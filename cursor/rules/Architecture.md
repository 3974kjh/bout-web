# Architecture.md

## 디렉터리 구조 (구현 기준)

```
src/
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte              # 메인 메뉴(랜딩) — 작전 개시·정비소·랭킹·음량 모달
│   ├── shop/+page.svelte         # 정비소(기체·미사일 색·선호 카드 → IndexedDB)
│   ├── rank/+page.svelte         # 랭킹(로컬 기록·시상대)
│   └── game/
│       ├── +page.svelte          # GameEngine 마운트 + HudOverlay
│       └── +page.ts              # ssr = false
├── lib/
│   ├── audio/
│   │   └── sfx.ts                # 효과음 — Web Audio 버퍼 + 음성 상한·티어·스로틀
│   ├── game/
│   │   ├── core/
│   │   │   ├── GameEngine.ts     # 메인 루프, 씬·시스템 조율, EventBus 허브
│   │   │   ├── InputManager.ts   # WASD, Space/C, Shift
│   │   │   └── CameraController.ts
│   │   ├── entities/
│   │   │   ├── Player.ts         # 이동·점프·대쉬·글라이드·머리 HUD 스프라이트
│   │   │   ├── Monster.ts        # AI, 근접/원거리, 보스 AOE, 프레임 태그 기반 시각 LOD
│   │   │   ├── MechModel.ts      # 절차적 메카 메시 + formForLevel
│   │   │   ├── playerSkinned.ts / playerSkinnedEvolution.ts  # GLTF 스키닝 로드·진화
│   │   │   ├── Projectile.ts     # 적/플레이어 발사체
│   │   │   ├── ExpShardManager.ts # 경험치 조각 — InstancedMesh 단일 드로우
│   │   │   ├── ExpShard.ts       # (레거시) 메쉬-per-조각 구현 — 런타임은 Manager 사용
│   │   │   └── PlatformLoot.ts   # 발판 체력 포션·카드 캐시
│   │   ├── systems/
│   │   │   ├── CombatSystem.ts   # 몬스터→플레이어 피해
│   │   │   ├── WaveSystem.ts     # 잡몹 스폰 + 보스 주기, 동시 생존 상한·간격 완화
│   │   │   ├── LevelSystem.ts    # EXP/레벨
│   │   │   ├── UpgradeSystem.ts  # 랜덤 카드·스탯 적용
│   │   │   └── PartsSystem.ts    # 초기 스탯 계산(파츠 타입)
│   │   ├── stages/
│   │   │   └── TrainingPlanet.ts # 지형·충돌·발판 루트
│   │   ├── shopSettings.ts
│   │   ├── shopGameCache.ts
│   │   ├── mechEvolutionDoc.ts
│   │   ├── constants/
│   │   │   └── GameConfig.ts
│   │   ├── bridge/
│   │   │   └── EventBus.ts
│   │   └── ui/
│   │       └── DamageNumbers.ts  # DOM 부유 숫자 — 동시 개수 상한·스크래치 벡터
│   ├── domain/
│   │   └── types.ts
│   ├── storage/
│   │   ├── shopIndexedDb.ts      # 정비소 설정
│   │   └── rankIndexedDb.ts      # 게임 오버 기록
│   ├── i18n/
│   └── components/
│       ├── HUD/
│       │   └── HudOverlay.svelte
│       ├── shop/                 # 정비소 Three 미리보기
│       │   ├── ShopMechPreview.svelte
│       │   └── ShopEvolutionGuide.svelte
│       ├── rank/
│       │   └── RankPodium.svelte
│       ├── AudioSettingsModal.svelte
│       └── BackToHomeButton.svelte
```

### 레거시·미연결 가능

`TransformSystem.ts`, `HealthItem.ts` 등은 리포지토리에 남아 있을 수 있으나 **`GameEngine`이 직접 구동하지 않을 수 있다.** 아키텍처 설명은 위 트리를 기준으로 한다.

---

## 레이어 경계

| 레이어 | 책임 | 금지 |
|--------|------|------|
| `routes/` | 페이지 조합, 게임 컨테이너 DOM | 게임 규칙 본문 |
| `lib/game/` | 3D 루프, 엔티티, 시스템 | Svelte 반응성 직접 import |
| `lib/domain/` | 공유 타입 | Three / Svelte 의존 |
| `lib/components/HUD` | 오버레이 UI | Three API 직접 호출 |
| `lib/components/shop` | 정비소 전용 Three 캔버스(미리보기·진화 스트립) | 게임 `GameEngine` 직접 참조 |

---

## Svelte ↔ Three 통신

단일 버스: `EventBus`. 상세 페이로드는 **`API.md`**.

---

## 런타임 씬(개략)

```
THREE.Scene
├── 조명·안개(난이도 테마 반영 가능)
├── TrainingPlanet (지형/구조물)
├── Player.group (진화 메카 메시)
├── Monster[].group (잡몹·보스 동물 메카)
├── Projectile[] / playerProjectiles[]
├── ExpShardManager.mesh (InstancedMesh, 다수 슬롯)
├── 발판 루트 아이템(포션·카드 캐시)
└── 이펙트 메시(AOE 링·킬 이펙트 등)
```

---

## 물리·충돌

- **중력**: `GRAVITY`, `Player` / `Monster` 의 `velocityY`
- **지면**: `StageQuery.getGroundHeight`
- **수평**: `resolveMovement` (AABB 스타일 충돌)
- **스텝업**: `STEP_UP_HEIGHT` (낮은 난간)
- **플레이어 미사일–적**: 궤적 세그먼트 vs 구형 히트(스케일·보스 반영); XZ 셀 버킷으로 근접 몬스터만 검사

---

## 성능·리소스 (요약)

| 영역 | 구현 요지 |
|------|-----------|
| SFX | `sfx.ts` — `AudioBuffer` 캐시·`AudioBufferSourceNode`, 동시 재생·URL별 상한·티어, 스로틀; `warmupSfx()` |
| 경험치 조각 | `ExpShardManager` — 공유 지오/머티리얼 `InstancedMesh`, 풀 포화 시 `addExp`로 즉시 지급 |
| 플레이어 투사체 | `GameEngine.rebuildMonsterProjBuckets` + 이웃 셀만 순회 |
| 몬스터 밀집 | `separateMonsters` 3×3 셀 + 다수 시 격프레임 |
| 몬스터 시각 | `Monster.update(..., frameTag)` — 중거리 일반몹 링 샘플·애니 격프레임(보스 제외) |
| 웨이브 | `WaveSystem` — 동시 상한(예: 72 기준)·살아 있는 수에 따른 스폰 간격 배율 |
| 데미지 숫자 | `DamageNumbers` — `project`용 스크래치 벡터, DOM 동시 개수 상한 |
| 정비소 GLTF | 스키닝 기체 미리보기·진화 스트립 — 로드 완료 전 원형 인디터미넷 오버레이 |

---

## 데이터 흐름 (한 프레임)

1. 입력 → `Player.update` (이동·점프·대쉬·중력)
2. `CombatSystem` — 몬스터 공격·접촉 데미지
3. `Monster.update` (살아 있는 몬스터 인덱스 기반 `frameTag` 전달)
4. 자동 미사일(셀 버킷 광역)·적 탄·`ExpShardManager.update`·발판 루트·웨이브·AOE 연출
5. `renderer.render` / `DamageNumbers` / 주기적 `EventBus` (미니맵·생존 시간 등)
