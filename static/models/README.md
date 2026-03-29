# 3D 모델 (`static/models`)

SvelteKit에서 **`/models/파일명`** 으로 제공됩니다. 스키닝 플레이어 GLTF URL은 `src/lib/game/constants/GameConfig.ts`의 `playerGltfUrlListForBase` / `MECH_BASES_USING_SKINNED_GLTF`에서 연결합니다.

| 파일 | 용도 |
|------|------|
| `player.glb` | **익스프레시브** — RobotExpressive 계열(로컬). 없으면 CDN. |
| `soldier.glb` | **솔저** — three.js Soldier.glb(Mixamo). 없으면 CDN. |
| `cyberpunk_human.glb` | **사이버펑크 휴먼** `cyberpunk-human` |
| `neon_human.glb` | **네온 휴먼** `neon-human` |

추가·교체 시 파일명을 유지하거나 `GameConfig`의 `LOCAL_GLTF_ONLY` / `MECH_BASES_USING_SKINNED_GLTF` / `MechBase` 타입을 함께 수정하세요.
