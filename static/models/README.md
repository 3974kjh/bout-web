# 3D 모델 (`static/models`)

SvelteKit에서 **`/models/파일명`** 으로 제공됩니다. 스키닝 플레이어 GLTF는 `src/lib/game/constants/GameConfig.ts`의 `PLAYER_GLTF_URLS` / `SOLDIER_GLTF_URLS`에서 이 경로를 **1순위**로 로드하고, 실패 시 three.js 예제 CDN으로 폴백합니다.

| 파일 | 용도 |
|------|------|
| `player.glb` | **익스프레시브** 기체 — RobotExpressive (로컬). 없으면 CDN `RobotExpressive.glb`. |
| `soldier.glb` | **솔저** 기체 — three.js [skinning blending](https://threejs.org/examples/#webgl_animation_skinning_blending) 예제와 동일한 Mixamo Soldier. 없으면 CDN `Soldier.glb`. |

추가·교체 시 파일명을 유지하거나 `GameConfig`의 URL 배열을 함께 수정하세요.
