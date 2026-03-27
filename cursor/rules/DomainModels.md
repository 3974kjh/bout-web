# DomainModels.md

> 기준 파일: `src/lib/domain/types.ts`. 바우트에서 이름·분위기를 차용한 **웹 오리지널 서바이벌**에 맞게 단순화·변형된 모델이다.

---

## MechBase

```ts
type MechBase = 'hypersuit' | 'azonas-v' | 'geren'
```

초기 스탯 계산(`PartsSystem` / `calculateStats`)에 사용. **인게임 종족 선택 UI는 Phase 2 예정.**

---

## MechStats

```ts
interface MechStats {
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  transformGauge: number      // 타입 호환 유지 필드
  maxTransformGauge: number
}
```

플레이어 기초 스탯. **변신 게이지 루프는 현재 엔진 핵심 경로에 없을 수 있음.**

---

## PlayerState

```ts
type PlayerState = 'idle' | 'walking' | 'jumping' | 'stunned' | 'dead'
```

근접 콤보/가드 전용 상태는 제거됨. 전투 출력은 **자동 미사일**이 담당.

---

## PlayerUpgrades (뱀서라이크 카드 스탯)

```ts
interface PlayerUpgrades {
  missileDamage: number
  missileSpeed: number
  fireRateMs: number
  missileCount: number
  piercingCount: number
  isHoming: boolean
  isExplosive: boolean
  explosionRadius: number
  missileScale: number
  spreadShot: boolean
  collectRange: number
  magnetRange: number
  moveSpeedMult: number
  maxHpMult: number
  pendingHealPct: number
  dashCooldownMult: number
}
```

---

## MonsterConfig

```ts
interface MonsterConfig {
  name: string
  hp: number
  attack: number
  defense: number
  speed: number
  detectionRange: number
  attackRange: number
  bodyColor: number
  accentColor: number
  scale: number
  isBoss?: boolean
  isRanged?: boolean
  projectileSpeed?: number
  fireRateMs?: number
  bossAnimalType?: 'bear' | 'wolf' | 'dragon' | 'tiger' | 'ironlord'
  aoeRadius?: number
  aoeFillMs?: number
  aoeCooldownMs?: number
}
```

- **보스**: `isBoss` + `bossAnimalType` — AOE 패턴·연출 분기
- **원거리 잡몹**: `isRanged` + 탄속/연사

---

## MonsterAIState

```ts
type MonsterAIState =
  | 'idle'
  | 'chase'
  | 'attack'
  | 'rangedAttack'
  | 'stun'
  | 'knockdown'
```

`knockdown` 등은 AI 구현에 따라 사용 빈도가 다를 수 있음.

---

## 잡몹·보스 (게임 내 이름 예시)

- **잡몹**: 베타 머신, 알파 머신, 빠른 날쇠, 체인 레이버, 레이저 보이 등 (`WaveSystem` 풀)
- **보스(동물 테마 5종 로테이션)**: 강철 곰, 기계 늑대, 철갑 드래곤, 사이버 호랑이, 아이언 로드 — 각각 `bossAnimalType` 매핑

(구버전 문서의 캡틴 레이버 등 **구 보스 명단은 현재 웨이브와 불일치하므로 삭제**)

---

## StageQuery

```ts
interface StageQuery {
  getGroundHeight(x: number, z: number, currentY: number): number
  resolveMovement(fromX, fromZ, toX, toZ, y, radius?): { x: number; z: number }
  bounds: { minX, maxX, minZ, maxZ }
}
```

---

## Part / MechParts (Phase 2)

파츠 장착·상점 UI와 연동 예정. 현재는 빈 슬롯으로 초기화해 스탯만 계산하는 수준.

---

## Room (Phase 3 — TODO: MULTI)

멀티플레이 도입 시 정의.
