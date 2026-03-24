# API.md

> Phase 3 구현 전, 이 파일에 Supabase 스키마/채널 계약을 먼저 정의한다.

## Supabase Tables (예정)

### rooms
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| host_id | uuid | FK → auth.users |
| status | text | waiting / in_game |
| created_at | timestamptz | |

### chat_messages
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| room_id | uuid | FK → rooms |
| user_id | uuid | FK → auth.users |
| content | text | |
| created_at | timestamptz | |

## Realtime 채널 컨벤션
- 게임 상태: `bout:room:{roomId}:game`
- 채팅: `bout:room:{roomId}:chat`

## 동기화 최소 페이로드 (게임)
```ts
interface SyncPayload {
  userId: string
  position: { x: number; y: number }
  hp: number
  transformState: TransformState
}
```

---
*스키마 확정 전까지 Supabase 구현 시작 금지*
