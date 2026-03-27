# BOUT Web

한게임 **바우트(B.O.U.T.)** 에서 영감을 받은 **웹 3D 메카 서바이벌 액션** 프로젝트입니다. 브라우저에서 바로 실행되며, **뱀서라이크형 성장(경험치·카드)** 과 **자동 사격**, **무한 웨이브·보스** 를 한 판에 담았습니다.

---

## 무엇을 하는 게임인가요?

- **3인칭 시점**으로 넓은 행성 지형을 누비며 **적이 끊임없이 스폰**됩니다.
- 플레이어는 **직접 조준하지 않고도** 미사일이 자동으로 발사됩니다. 레벨이 오를수록 **카드 선택**으로 연사·관통·유도·폭발 등을 강화합니다.
- 일정 주기로 **대형 보스**가 등장합니다. 보스는 종류별로 **광역 AOE** 등 고위협 패턴을 가집니다.
- 발판 위에 떨어지는 **체력 포션**과 **카드 보급 캐시**를 먹으면 즉시 회복하거나 추가 카드 선택을 할 수 있습니다.
- 상단 HUD에는 **생존 시간**, **미니맵**(플레이어·적·아이템), **보스/일반 처치 통계** 등이 표시됩니다.
- **게임 오버** 시에는 보스 종류별 처치 수·일반 처치·달성 레벨·생존 시간을 바탕으로 한 **가중치 점수(정수)** 가 표시됩니다.

---

## 조작

| 동작 | 입력 |
|------|------|
| 이동 | `W` `A` `S` `D` |
| 점프 | `Space` 또는 `C` |
| 2단 점프 | 레벨 10 이상, 공중에서 한 번 더 점프 |
| 공중 글라이드 | 메카 **날개 폼(form 7, 약 Lv17~)** 이후, 2단 점프 후 공중에서 `Space`/`C`를 잠시 길게 누름 |
| 대쉬 | `Shift` (쿨다운은 캐릭터 머리 위 스프라이트 바에서 확인) |
| 일시정지 | `Esc` |
| 카드 선택(모달) | `1` `2` `3` 또는 클릭 |

---

## 기술 스택

| 구분 | 사용 |
|------|------|
| 프레임워크 | **SvelteKit** 2, **Svelte** 5 |
| 3D | **Three.js** |
| 언어 | **TypeScript** (strict) |
| 빌드 | **Vite** 7 |

게임 로직(Three.js)과 UI(Svelte)는 **`EventBus`** 로만 이벤트를 주고받도록 분리되어 있습니다. 이벤트 목록은 `cursor/rules/API.md` 를 참고하세요.

---

## 로컬 실행

```sh
npm install
npm run dev
```

브라우저에서 개발 서버 주소로 접속한 뒤, 메인 화면의 **작전 개시** 로 `/game` 에 진입합니다.

### 기타 스크립트

| 명령 | 설명 |
|------|------|
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run check` | `svelte-check` 타입·진단 |
| `npm run lint` | Prettier + ESLint |
| `npm test` | Vitest 단위 테스트 |

---

## 프로젝트 구조 (요약)

```
src/
├── routes/
│   ├── +page.svelte       # 랜딩
│   └── game/+page.svelte  # 게임 캔버스 + HUD
├── lib/
│   ├── game/
│   │   ├── core/GameEngine.ts    # 메인 루프
│   │   ├── entities/             # Player, Monster, ExpShard, PlatformLoot …
│   │   ├── systems/              # Wave, Level, Upgrade, Combat …
│   │   ├── stages/TrainingPlanet.ts
│   │   ├── constants/GameConfig.ts  # 물리·대쉬·점수식 등
│   │   └── bridge/EventBus.ts
│   ├── domain/types.ts
│   └── components/HUD/HudOverlay.svelte
└── cursor/rules/            # Cursor용 아키텍처·API·마일스톤 문서
```

자세한 디렉터리 설명은 `cursor/rules/Architecture.md` 를 읽으면 됩니다.

---

## 로드맵 (문서 기준)

- **Phase 1**: 싱글 3D 서바이벌 코어 (현재 본 레포의 중심)
- **Phase 2**: 메인 메뉴 확장, 종족·파츠 선택 UI, 스테이지 선택 등
- **Phase 3**: Supabase 기반 멀티플레이 (스키마는 `cursor/rules/API.md` 하단 예정 섹션 참고)

---

## 라이선스·원작 표기

이 프로젝트는 **비공식 팬 메이드**에 가깝습니다. **바우트** 상표·원작 에셋·서버는 포함하지 않으며, 구현·수치·이름은 웹 오리지널에 맞게 변형되었습니다.

---

## 문서

AI·기여자용 규칙은 `cursor/rules/` 를 우선합니다.

- `cursorrules` — 작업 원칙·스택 경계
- `Architecture.md` — 구조
- `DomainModels.md` — 도메인 타입 설명
- `API.md` — EventBus 계약
- `Project_milestones.md` — 마일스톤
