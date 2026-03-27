# Architecture.md

## 디렉터리 구조 (구현 기준)

```
src/
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte              # 메인 메뉴(랜딩)
│   ├── shop/+page.svelte         # 정비소(기체·미사일 색·선호 카드 → IndexedDB)
│   └── game/
│       ├── +page.svelte          # GameEngine 마운트 + HudOverlay
│       └── +page.ts              # ssr = false
├── lib/
│   ├── game/
│   │   ├── core/
│   │   │   ├── GameEngine.ts     # 메인 루프, 씬·시스템 조율, EventBus 허브
│   │   │   ├── InputManager.ts   # WASD, Space/C, Shift
│   │   │   └── CameraController.ts
│   │   ├── entities/
│   │   │   ├── Player.ts         # 이동·점프·대쉬·글라이드·머리 HUD 스프라이트
│   │   │   ├── Monster.ts        # AI, 근접/원거리, 보스 AOE 트리거
│   │   │   ├── MechModel.ts      # 절차적 메카 메시 + formForLevel
│   │   │   ├── Projectile.ts     # 적/플레이어 발사체
│   │   │   ├── ExpShard.ts       # 경험치 조각
│   │   │   └── PlatformLoot.ts   # 발판 체력 포션·카드 캐시
│   │   ├── systems/
│   │   │   ├── CombatSystem.ts   # 몬스터→플레이어 피해
│   │   │   ├── WaveSystem.ts     # 잡몹 스폰 + 보스 주기
│   │   │   ├── LevelSystem.ts    # EXP/레벨
│   │   │   ├── UpgradeSystem.ts  # 랜덤 카드·스탯 적용
│   │   │   └── PartsSystem.ts    # 초기 스탯 계산(파츠 타입)
│   │   ├── stages/
│   │   │   └── TrainingPlanet.ts # 지형·충돌·발판 루트
│   │   ├── shopSettings.ts       # 상점 설정 타입·검증·미사일 스킨 정의
│   │   ├── shopGameCache.ts      # 게임 루프용 설정 스냅샷(prime/refresh)
│   │   ├── mechEvolutionDoc.ts   # 상점용 진화 단계·메쉬 트리 문서 데이터
│   │   ├── constants/
│   │   │   └── GameConfig.ts     # 물리·대쉬·점수식 등
│   │   ├── bridge/
│   │   │   └── EventBus.ts
│   │   └── ui/
│   │       └── DamageNumbers.ts
│   ├── domain/
│   │   └── types.ts
│   ├── storage/
│   │   └── shopIndexedDb.ts      # IndexedDB `bout-web` / 마이그레이션(구 localStorage)
│   └── components/
│       └── HUD/
│           └── HudOverlay.svelte
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
├── ExpShard[]
├── 발판 루트 아이템(포션·카드 캐시)
└── 이펙트 메시(AOE 링·킬 이펙트 등)
```

---

## 물리·충돌

- **중력**: `GRAVITY`, `Player` / `Monster` 의 `velocityY`
- **지면**: `StageQuery.getGroundHeight`
- **수평**: `resolveMovement` (AABB 스타일 충돌)
- **스텝업**: `STEP_UP_HEIGHT` (낮은 난간)

---

## 데이터 흐름 (한 프레임)

1. 입력 → `Player.update` (이동·점프·대쉬·중력)
2. `CombatSystem` — 몬스터 공격·접촉 데미지
3. 자동 미사일·적 탄·조각·발판 루트·웨이브·AOE 연출
4. `renderer.render` / `DamageNumbers` / 주기적 `EventBus` (미니맵·생존 시간 등)
