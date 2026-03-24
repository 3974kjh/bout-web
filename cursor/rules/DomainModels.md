# DomainModels.md

## Mech (메카닉)
```ts
type MechBase = 'hypersuit' | 'azonas-v' | 'geren'

interface Mech {
  id: string
  base: MechBase
  parts: MechParts
  stats: MechStats
  transformState: TransformState
}
```

## Parts
```ts
type PartSlot = 'head' | 'body' | 'arm' | 'leg' | 'weapon'

interface Part {
  id: string
  slot: PartSlot
  name: string
  statModifier: Partial<MechStats>
}

interface MechParts extends Record<PartSlot, Part | null> {}
```

## Stats
```ts
interface MechStats {
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  transformGauge: number
  maxTransformGauge: number
}
```

## TransformState
```ts
type TransformState = 'normal' | 'transformed'
```

## Monster
```ts
type MonsterAIState = 'idle' | 'chase' | 'attack' | 'stun'

interface Monster {
  id: string
  stats: Pick<MechStats, 'hp' | 'maxHp' | 'attack' | 'defense' | 'speed'>
  aiState: MonsterAIState
}
```

## Room (Phase 3 - TODO: MULTI)
```ts
interface Room {
  id: string
  hostId: string
  players: string[]
  status: 'waiting' | 'in_game'
  createdAt: string
}
```
