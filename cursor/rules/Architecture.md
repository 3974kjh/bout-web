# Architecture.md

## 디렉터리 구조
```
src/
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte              # 메인 메뉴
│   ├── login/+page.svelte
│   ├── lobby/+page.svelte        # 대기 메인 화면
│   ├── room/+page.svelte         # 방 대기 화면
│   ├── game/+page.svelte         # Phaser 마운트 (SSR=false)
│   └── shop/+page.svelte
├── lib/
│   ├── phaser/
│   │   ├── config.ts
│   │   ├── constants/AssetKeys.ts
│   │   ├── scenes/
│   │   │   ├── BootScene.ts
│   │   │   ├── PreloadScene.ts
│   │   │   ├── BattleScene.ts
│   │   │   └── HUDScene.ts
│   │   ├── entities/
│   │   │   ├── Mech.ts
│   │   │   ├── Monster.ts
│   │   │   └── Projectile.ts
│   │   ├── systems/
│   │   │   ├── CombatSystem.ts
│   │   │   ├── PartsSystem.ts
│   │   │   └── TransformSystem.ts
│   │   └── bridge/
│   │       └── EventBus.ts       # Svelte ↔ Phaser 통신
│   ├── domain/                   # 순수 타입/로직 (→ DomainModels.md)
│   ├── supabase/
│   │   ├── client.ts             # 단일 초기화
│   │   └── helpers/              # TODO: MULTI
│   ├── components/
│   │   ├── HUD/
│   │   ├── Menu/
│   │   ├── Modal/
│   │   │   ├── CreateRoomModal.svelte
│   │   │   ├── UserInfoModal.svelte
│   │   │   └── SettingsModal.svelte
│   │   └── Shop/
│   └── styles/
│       ├── abstracts/ (_variables, _mixins, _index)
│       ├── base/
│       ├── layout/
│       ├── components/
│       ├── themes/ (_light, _dark)
│       └── main.scss
```

## 레이어 경계
| 레이어 | 책임 | 금지 |
|---|---|---|
| `routes/` | 페이지 조합, SSR 설정 | 게임 로직 |
| `lib/phaser/` | 게임 루프 전체 | Svelte store 직접 import |
| `lib/domain/` | 타입·계산 로직 | 프레임워크 의존 |
| `lib/components/` | UI 렌더링 | Phaser API 직접 호출 |
| `lib/supabase/` | DB·Realtime 연결 | 씬 내부 직접 사용 |

## Svelte ↔ Phaser 통신
- 게임 → UI: `EventBus.emit(event, payload)` → Svelte store 갱신
- UI → 게임: `EventBus.emit(event, payload)` → Scene 리스너 처리
