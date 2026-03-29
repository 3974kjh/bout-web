# API.md — EventBus 계약

게임 엔진(`GameEngine` / Three.js 쪽)과 UI(Svelte `HudOverlay` 등)는 **`src/lib/game/bridge/EventBus.ts`** 로만 상태를 주고받는다.

---

## HUD → Engine (UI가 emit)

| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `upgrade-chosen` | `{ id: string }` | 레벨업/필드 보급 모달에서 선택한 업그레이드 카드 id |
| `game-pause-set` | `{ paused: boolean }` | ESC 일시정지 등 |
| `restart-game` | (없음) | 게임 오버 후 재시작 — 엔진이 루프·씬 재초기화 |

---

## Engine → HUD (게임이 emit)

| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `hp-update` | `{ hp: number, maxHp: number }` | 플레이어 HP |
| `exp-update` | `{ level, exp, expToNext, progress }` | 경험치 바·레벨 (진화 프리뷰 동기화) |
| `level-up` | `{ level: number, cards: UpgradeCardInfo[] }` | 레벨업 모달 표시 |
| `field-card-offer` | `{ cards: UpgradeCardInfo[] }` | 발판 카드 캐시 수집 시 모달 |
| `upgrade-picked` | `{ id: string }` | 카드 확정 후 HUD 획득 목록 갱신용 |
| `survival-time-update` | `{ seconds: number }` | 생존 시간(초, 실수 누적의 floor 아님 — 표시용은 HUD에서 처리) |
| `monster-count-update` | `{ remaining: number, total: number }` | 잔여 적 수 (`total`은 레거시 필드로 0 등 사용) |
| `kill-stats-update` | `{ normal: number, bosses: Record<보스종, number> }` | 일반/보스(5종) 처치 수 |
| `minimap-update` | `{ player, monsters, bounds, viewport, loot? }` | 미니맵 캔버스용 |
| `boss-incoming` | (없음) | 보스 스폰 알림 배너 |
| `boss-cleared` | (없음) | 보스 격파·HP 회복 연출 |
| `kill-streak` | `{ streak: number }` | 연속 처치 |
| `damage-number` | `{ pos: THREE.Vector3, amount: number, type: 'deal'\|'take'\|'heal' }` | 부유 데미지 숫자 |
| `game-over` | 아래 표 참고 | 사망 시 최종 통계·점수 |

### `game-over` 페이로드

| 필드 | 타입 | 설명 |
|------|------|------|
| `survivalTime` | `number` | 생존 시간(초, 정수) |
| `bossCount` | `number` | `WaveSystem` 기준 보스 격파 누적(난이도 스케일용) |
| `level` | `number` | 사망 시 레벨 |
| `normalKills` | `number` | 일반 몬스터 처치 수 |
| `bosses` | `{ bear, wolf, dragon, tiger, ironlord }` | 단계별 보스 타입별 처치 수 |
| `scoreTotal` | `number` | 총점(정수) |
| `scoreBoss` / `scoreLevel` / `scoreTime` | `number` | 보스·레벨·생존 기여 분해(정수) |

---

## Engine 내부 / 보조 (Svelte가 안 쓸 수 있음)

| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `boss-defeated` | (없음) | 몬스터 사망 처리 중 — `GameEngine`이 구독해 보스 보상·웨이브 처리 |
| `enemy-projectile` | `{ pos, dir, damage, speed }` | 원거리 몬스터 탄 생성 |
| `boss-aoe-request` | (Monster 쪽 정의) | 보스 AOE 시각·판정 요청 |
| `player-hit` | `{ damage: number }` | 플레이어 피격 (연쇄 로직용) |
| `dash-update` | `{ cooldown: number, maxCooldown: number }` | 대쉬 쿨 — **현재는 머리 위 스프라이트 HUD 갱신용**(오버레이 미구독 가능) |

> **미사용(레거시 문서만 존재)**: `gauge-update`, `wave-update`, `transform-state-change` 등은 현재 엔진에서 일반적으로 emit하지 않는다. 추가 시 이 파일을 갱신할 것.

---

## 사용 예

```ts
EventBus.emit('hp-update', { hp: 80, maxHp: 100 });

EventBus.on('hp-update', (...args) => {
  const d = args[0] as { hp: number; maxHp: number };
});

EventBus.off('hp-update', handler);
EventBus.removeAll(); // 게임 파괴 시
```

---

## Phase 3 — Supabase (예정)

> **구현 전 이 섹션을 먼저 확정할 것**

### rooms 테이블 (초안)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| host_id | uuid | FK → auth.users |
| status | text | waiting / in_game |
| mode | text | planet_battle / pvp / rvr |
| created_at | timestamptz | |

### player_states 테이블 (초안)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| room_id | uuid | FK → rooms |
| user_id | uuid | FK → auth.users |
| mech_base | text | hypersuit / azonas-v / geren |
| position_x | float | |
| position_z | float | |
| hp | int | |
| transform_state | text | normal / transformed |

### Realtime 채널 컨벤션 (초안)

- 게임 상태: `bout:room:{roomId}:game`
- 채팅: `bout:room:{roomId}:chat`

### 동기화 최소 페이로드 (초안)

```ts
interface SyncPayload {
  userId: string
  position: { x: number; z: number }
  hp: number
  transformState: 'normal' | 'transformed'
}
```
