import type { MechBase } from '$lib/domain/types';
import { MECH_SHOP_INFO } from './shopSettings';

/**
 * 플레이어 메카는 `MechModel.createEvolvedModel(form, scale, mechBase)`.
 * MechBase마다 서로 다른 기하 파이프라인(EvolvedMechByBase) — 직육면체 / 삼각·원뿔 / 구·원통.
 */
export const PLAYER_MESH_PIPELINE =
	'THREE.Group(루트) ← Player.group · mechBase별 createEvolvedModel · scaleForLevel(lv) · form = formForLevel(lv)';

export const MECH_BASE_3D_NOTE: Record<MechBase, string> = {
	hypersuit: `${MECH_SHOP_INFO.hypersuit.name}: Box 위주 진화 메쉬. HP/방어 높고 속도 보통.`,
	'azonas-v': `${MECH_SHOP_INFO['azonas-v'].name}: Octahedron·Cone(3)·삼각기둥 위주. HP 낮고 공격·속도 높음.`,
	geren: `${MECH_SHOP_INFO.geren.name}: Sphere·Cylinder·Torus 위주. HP·방어 최고, 속도 낮음.`,
	expressive: `${MECH_SHOP_INFO.expressive.name}: GLTF 스키닝 + Form별 절차 외장. 스탯은 하이퍼슈트와 동일.`,
	soldier: `${MECH_SHOP_INFO.soldier.name}: three.js Soldier.glb(Mixamo) 스키닝, Idle/Walk/Run.`
};

/** 레벨 구간 ↔ form (MechModel.formForLevel) */
export const FORM_LEVEL_BRACKETS: { form: number; levels: string }[] = [
	{ form: 0, levels: 'Lv 1–2' },
	{ form: 1, levels: 'Lv 3–4' },
	{ form: 2, levels: 'Lv 5–6' },
	{ form: 3, levels: 'Lv 7–8' },
	{ form: 4, levels: 'Lv 9–10' },
	{ form: 5, levels: 'Lv 11–13' },
	{ form: 6, levels: 'Lv 14–16' },
	{ form: 7, levels: 'Lv 17–19' },
	{ form: 8, levels: 'Lv 20+' }
];

/** 각 form의 Three.js 객체 트리(코드 기준 요약, 스케일 인자 s) */
export const FORM_MESH_TREE: {
	form: number;
	title: string;
	tree: string[];
}[] = [
	{
		form: 0,
		title: '프로토 큐브',
		tree: [
			'group (루트)',
			'├─ Mesh BoxGeometry(0.80s × 1.0s × 0.80s) — body, y=0.50s, castShadow',
			'├─ Group head (빈)',
			'├─ Group leftArm (빈)',
			'├─ Group rightArm (빈)',
			'├─ Group leftLeg (빈)',
			'└─ Group rightLeg (빈)',
			'※ parts.body = 큐브 메시, bodyTargetY = 0.50s'
		]
	},
	{
		form: 1,
		title: '머리·팔 돌기',
		tree: [
			'group',
			'├─ Mesh Box(0.80×0.90×0.80)s — torso, y=0.55s',
			'├─ Group head @ y=1.06s',
			'│   └─ Mesh Box(0.30×0.22×0.30)s — 헬멧 블록',
			'├─ Group leftArm @ (-0.45s, 0.68s, 0)',
			'│   └─ Mesh Box(0.18³)s — 어깨 돌기',
			'├─ Group rightArm @ (+0.45s, 0.68s, 0)',
			'│   └─ Mesh Box(0.18³)s',
			'├─ Group leftLeg (빈)',
			'└─ Group rightLeg (빈)'
		]
	},
	{
		form: 2,
		title: '휴머노이드 골격 (다리 미완)',
		tree: [
			'group',
			'├─ Mesh Box(0.78×0.60×0.50)s — body @ MECH_BODY_Y·s (=1.72s)',
			'├─ Group head @ y=2.40s',
			'│   └─ Mesh Box — 헬멧 (폭 0.32s)',
			'├─ leftArm / rightArm @ (±0.46s, MECH_BODY_Y·s, 0)',
			'│   └─ Mesh Box(0.14×0.40×0.14)s — 상완',
			'├─ Group leftLeg (빈)',
			'└─ Group rightLeg (빈)'
		]
	},
	{
		form: 3,
		title: '바이저·완전 다리',
		tree: [
			'위 form 2 공통 +',
			'├─ head: Mesh Box 바이저 슬릿 (accent 발광)',
			'├─ leftLeg / rightLeg: 각 Group + Mesh Box 대퇴 (길이 0.28s)',
			'└─ 팔 길이 aLen=0.40s'
		]
	},
	{
		form: 4,
		title: '목·허리·전완',
		tree: [
			'├─ head: 헬멧 폭 0.40s',
			'├─ Mesh CylinderGeometry 목 — y=2.14s',
			'├─ Mesh Box 허리 — y=1.28s',
			'├─ 팔: aLen=0.58s, 전완 Box + (f≥5 시 주먹 accent)',
			'└─ 다리: lLen=0.55s, 발 Box (f≥5)'
		]
	},
	{
		form: 5,
		title: '가슴판·어깨 장갑',
		tree: [
			'├─ Mesh Box 가슴 장갑 + accent 해치 (앞면 -Z)',
			'├─ 팔: 어깨 장갑 Box(sp) + 주먹 accent',
			'└─ 다리: lLen=0.80s, 무릎 accent, 발'
		]
	},
	{
		form: 6,
		title: '헬름 핀·다리 강화',
		tree: [
			'├─ head: 금색 얇은 Box 핀 2개 (좌우)',
			'├─ 다리: lLen=0.80s, 무릎 accent 블록',
			'└─ 팔 aLen=0.72s'
		]
	},
	{
		form: 7,
		title: '날개 (글라이드 해금 단계)',
		tree: [
			'├─ 좌우 각 2겹 Mesh Box 날개 (accent 발광)',
			'│   위치: x=±(0.52+wi·0.12)s, y=(MECH_BODY_Y+0.1-wi·0.25)s, z=(0.22+wi·0.08)s',
			'└─ rotation.z = ±(0.32 + wi·0.18)'
		]
	},
	{
		form: 8,
		title: '숄더 캐논',
		tree: [
			'├─ 어깨 x=±0.62s: Mesh Box 마운트 + CylinderGeometry 캐논 바렐 (accent 발광)',
			'└─ 바렐 rotation.x = -π/2, 전방 -Z'
		]
	}
];
