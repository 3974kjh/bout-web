import * as THREE from 'three';

/**
 * MechParts3D: leftArm / rightArm / leftLeg / rightLeg 는 피벗 Group.
 * 모든 모델: 얼굴은 -Z 방향. 발 밑면은 local y=0.
 * Player에서 lookAt(pos - dir)를 사용해 -Z 축이 이동방향을 향하도록 함.
 */
export interface MechParts3D {
	head: THREE.Object3D;
	body: THREE.Object3D;      // 가슴 중심 (position.y 애니메이션용)
	leftArm: THREE.Object3D;   // 어깨 피벗 Group
	rightArm: THREE.Object3D;
	leftLeg: THREE.Object3D;   // 고관절 피벗 Group
	rightLeg: THREE.Object3D;
	bodyMat: THREE.MeshStandardMaterial;
	accentMat: THREE.MeshStandardMaterial;
	/** body.position.y 애니메이션 목표값 (form-dependent) */
	bodyTargetY: number;
}

/** 가슴 중심 Y 팩터 (× scale = world Y). Player.ts 애니메이션에서 사용 */
export const MECH_BODY_Y = 1.72;

// ─────────────────────────────────────────────────────────────────────────────
//  플레이어 건담 스타일 모델
//  얼굴 방향: -Z / 발 밑면: local y=0 / 총 높이: ≈3.0*s
// ─────────────────────────────────────────────────────────────────────────────
export function createMechModel(
	bodyColor: number,
	accentColor: number,
	s: number = 1
): { group: THREE.Group; parts: MechParts3D } {
	const group = new THREE.Group();

	const bodyMat = new THREE.MeshStandardMaterial({
		color: bodyColor,
		roughness: 0.45,
		metalness: 0.65,
		emissive: new THREE.Color(bodyColor).multiplyScalar(0.04)
	});
	const accentMat = new THREE.MeshStandardMaterial({
		color: accentColor,
		roughness: 0.25,
		metalness: 0.72,
		emissive: new THREE.Color(accentColor).multiplyScalar(0.22)
	});
	const whiteMat = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.42, metalness: 0.52 });
	const goldMat = new THREE.MeshStandardMaterial({
		color: 0xffdd00,
		emissive: new THREE.Color(0xffcc00),
		emissiveIntensity: 0.55,
		roughness: 0.22,
		metalness: 0.82
	});
	const visorMat = new THREE.MeshStandardMaterial({
		color: accentColor,
		emissive: new THREE.Color(accentColor),
		emissiveIntensity: 2.4,
		roughness: 0.04
	});
	const darkMat = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.6, metalness: 0.55 });

	// ── HEAD (center at y=2.42*s, face toward -Z) ───────────────────────────
	const head = new THREE.Group();
	head.position.y = 2.42 * s;
	group.add(head);

	// 헬멧 본체
	const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.40 * s, 0.38 * s, 0.38 * s), bodyMat.clone());
	helmet.castShadow = true;
	head.add(helmet);

	// 페이스 플레이트 (앞 -Z 방향으로 돌출)
	const face = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.26 * s, 0.10 * s), whiteMat.clone());
	face.position.set(0, -0.04 * s, -0.22 * s);
	head.add(face);

	// 바이저 (발광, -Z 앞)
	const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.072 * s, 0.06 * s), visorMat.clone());
	visor.position.set(0, -0.02 * s, -0.26 * s);
	head.add(visor);

	// V-핀 (황금, 양쪽 기울어진 스파이크)
	for (const sx of [-1, 1]) {
		const fin = new THREE.Mesh(new THREE.BoxGeometry(0.055 * s, 0.32 * s, 0.040 * s), goldMat.clone());
		fin.position.set(sx * 0.095 * s, 0.28 * s, -0.14 * s);
		fin.rotation.z = sx * 0.38;
		head.add(fin);
	}

	// 턱 가드
	const chin = new THREE.Mesh(new THREE.BoxGeometry(0.30 * s, 0.08 * s, 0.16 * s), bodyMat.clone());
	chin.position.set(0, -0.23 * s, -0.14 * s);
	head.add(chin);

	// 귀 센서 (사각)
	for (const sx of [-1, 1]) {
		const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.14 * s, 0.10 * s), accentMat.clone());
		ear.position.set(sx * 0.22 * s, 0.04 * s, 0);
		head.add(ear);
	}

	// ── NECK ────────────────────────────────────────────────────────────────
	const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * s, 0.13 * s, 0.22 * s, 7), bodyMat.clone());
	neck.position.set(0, 2.14 * s, 0);
	group.add(neck);

	// ── TORSO ───────────────────────────────────────────────────────────────
	// 가슴 (animation 기준 body mesh)
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.82 * s, 0.62 * s, 0.50 * s), bodyMat);
	body.position.y = MECH_BODY_Y * s;
	body.castShadow = true;
	group.add(body);

	// 흉부 화이트 아머 플레이트 (앞면 -Z)
	const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.52 * s, 0.52 * s, 0.08 * s), whiteMat.clone());
	chestPlate.position.set(0, MECH_BODY_Y * s + 0.04 * s, -0.27 * s);
	group.add(chestPlate);

	// 콕핏 해치 (발광)
	const hatch = new THREE.Mesh(
		new THREE.BoxGeometry(0.20 * s, 0.18 * s, 0.04 * s),
		new THREE.MeshStandardMaterial({
			color: accentColor,
			emissive: new THREE.Color(accentColor),
			emissiveIntensity: 0.85,
			roughness: 0.15
		})
	);
	hatch.position.set(0, MECH_BODY_Y * s + 0.06 * s, -0.29 * s);
	group.add(hatch);

	// 복부 플레이트 2단
	for (let i = 0; i < 2; i++) {
		const ab = new THREE.Mesh(new THREE.BoxGeometry(0.52 * s, 0.11 * s, 0.44 * s), whiteMat.clone());
		ab.position.set(0, (1.44 + i * 0.14) * s, 0);
		group.add(ab);
	}

	// 허리
	const waist = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.22 * s, 0.44 * s), bodyMat.clone());
	waist.position.y = 1.30 * s;
	group.add(waist);

	// 백팩
	const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.56 * s, 0.44 * s, 0.18 * s), darkMat.clone());
	backpack.position.set(0, MECH_BODY_Y * s, 0.33 * s);
	group.add(backpack);
	// 스러스터 노즐 2개
	for (const tx of [-0.15 * s, 0.15 * s]) {
		const nzl = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.10 * s, 0.12 * s, 6), darkMat.clone());
		nzl.position.set(tx, (MECH_BODY_Y - 0.08) * s, 0.46 * s);
		nzl.rotation.x = -Math.PI / 2;
		group.add(nzl);
		// 스러스터 발광
		const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.03 * s, 6), accentMat.clone());
		glow.position.set(tx, (MECH_BODY_Y - 0.08) * s, 0.52 * s);
		glow.rotation.x = -Math.PI / 2;
		group.add(glow);
	}

	// ── SHOULDER PADS (장식, 비 애니메이션) ────────────────────────────────
	for (const sx of [-1, 1]) {
		const pad = new THREE.Mesh(new THREE.BoxGeometry(0.30 * s, 0.32 * s, 0.38 * s), whiteMat.clone());
		pad.position.set(sx * 0.68 * s, 1.92 * s, 0);
		pad.castShadow = true;
		group.add(pad);
		const padTop = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.05 * s, 0.40 * s), accentMat.clone());
		padTop.position.set(sx * 0.68 * s, 2.08 * s, 0);
		group.add(padTop);
	}

	// ── ARM PIVOTS (어깨에서 피벗, 팔 아래로) ─────────────────────────────
	function makeArm(side: number): THREE.Group {
		const arm = new THREE.Group();
		arm.position.set(side * 0.56 * s, 1.90 * s, 0);

		// 상완
		const ua = new THREE.Mesh(new THREE.BoxGeometry(0.20 * s, 0.46 * s, 0.22 * s), bodyMat.clone());
		ua.position.y = -0.23 * s;
		ua.castShadow = true;
		arm.add(ua);

		// 팔꿈치 가드
		const elbow = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.13 * s, 0.28 * s), whiteMat.clone());
		elbow.position.y = -0.48 * s;
		arm.add(elbow);

		// 전완 (건틀릿)
		const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.42 * s, 0.25 * s), whiteMat.clone());
		forearm.position.y = -0.72 * s;
		arm.add(forearm);

		// 주먹
		const fist = new THREE.Mesh(new THREE.BoxGeometry(0.20 * s, 0.18 * s, 0.22 * s), bodyMat.clone());
		fist.position.y = -1.00 * s;
		arm.add(fist);

		return arm;
	}

	// ── HIP ARMOR ───────────────────────────────────────────────────────────
	const hipArmor = new THREE.Mesh(new THREE.BoxGeometry(0.60 * s, 0.14 * s, 0.44 * s), whiteMat.clone());
	hipArmor.position.y = 1.23 * s;
	group.add(hipArmor);
	for (const sx of [-1, 1]) {
		const side = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.28 * s, 0.20 * s), bodyMat.clone());
		side.position.set(sx * 0.36 * s, 1.10 * s, 0);
		group.add(side);
	}

	// ── LEG PIVOTS (고관절에서 피벗, 다리 아래로. 발 밑 = y=0) ───────────
	//  pivot y=1.22*s → 발 중심 y=-1.16*s → 발 밑 y=-1.22*s → world y=0 ✓
	function makeLeg(side: number): THREE.Group {
		const leg = new THREE.Group();
		leg.position.set(side * 0.22 * s, 1.22 * s, 0);

		// 허벅지
		const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.27 * s, 0.52 * s, 0.27 * s), bodyMat.clone());
		thigh.position.y = -0.26 * s;
		thigh.castShadow = true;
		leg.add(thigh);

		// 무릎 패드 (살짝 앞으로, 얼굴 방향 -Z)
		const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.16 * s, 0.18 * s), accentMat.clone());
		kneePad.position.set(0, -0.52 * s, -0.06 * s);
		leg.add(kneePad);

		// 하퇴 (그리브, 발목 쪽 약간 넓게)
		const greave = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.58 * s, 0.30 * s), whiteMat.clone());
		greave.position.y = -0.82 * s;
		leg.add(greave);

		// 발목 장식
		const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.10 * s, 0.32 * s), bodyMat.clone());
		ankle.position.y = -1.12 * s;
		leg.add(ankle);

		// 발 (발꿈치~앞쪽 큰 박스, 발 밑 y=-1.22*s = world 0)
		// foot center y = -1.16*s, height = 0.12*s → bottom = -1.22*s ✓
		const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.12 * s, 0.42 * s), bodyMat.clone());
		foot.position.set(0, -1.16 * s, -0.06 * s); // 살짝 앞쪽으로
		leg.add(foot);

		return leg;
	}

	const leftArm = makeArm(-1);
	const rightArm = makeArm(1);
	group.add(leftArm, rightArm);

	const leftLeg = makeLeg(-1);
	const rightLeg = makeLeg(1);
	group.add(leftLeg, rightLeg);

	return { group, parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: MECH_BODY_Y * s } };
}

// ─────────────────────────────────────────────────────────────────────────────
//  변신 건담 — 더 크고 화염 테마, 같은 피벗 구조
// ─────────────────────────────────────────────────────────────────────────────
export function createTransformedMechModel(): { group: THREE.Group; parts: MechParts3D } {
	const group = new THREE.Group();
	const s = 1.22;

	const bodyMat = new THREE.MeshStandardMaterial({
		color: 0x8b1a00,
		roughness: 0.30,
		metalness: 0.78,
		emissive: new THREE.Color(0x2a0800),
		emissiveIntensity: 0.35
	});
	const accentMat = new THREE.MeshStandardMaterial({
		color: 0xff4400,
		roughness: 0.18,
		metalness: 0.85,
		emissive: new THREE.Color(0xff2200),
		emissiveIntensity: 0.65
	});
	const glowMat = new THREE.MeshStandardMaterial({
		color: 0xffee00,
		emissive: new THREE.Color(0xffcc00),
		emissiveIntensity: 3.0,
		roughness: 0.06,
		metalness: 0.95
	});
	const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.7, metalness: 0.5 });
	const visorMat = new THREE.MeshStandardMaterial({
		color: 0xff8800,
		emissive: new THREE.Color(0xff5500),
		emissiveIntensity: 4.5,
		roughness: 0.04
	});

	// ── HEAD ─────────────────────────────────────────────────────────────────
	const head = new THREE.Group();
	head.position.y = 2.50 * s;
	group.add(head);

	const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.44 * s, 0.42 * s), bodyMat.clone());
	helmet.castShadow = true;
	head.add(helmet);

	const face = new THREE.Mesh(new THREE.BoxGeometry(0.35 * s, 0.28 * s, 0.10 * s), accentMat.clone());
	face.position.set(0, -0.04 * s, -0.24 * s);
	head.add(face);

	const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.085 * s, 0.06 * s), visorMat.clone());
	visor.position.set(0, -0.02 * s, -0.29 * s);
	head.add(visor);

	// 크레스트 스파이크 (3개 황금)
	for (let i = -1; i <= 1; i++) {
		const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045 * s, 0.50 * s, 4), glowMat.clone());
		spike.position.set(i * 0.12 * s, 0.50 * s, -0.06 * s);
		head.add(spike);
	}

	// ── NECK ─────────────────────────────────────────────────────────────────
	const tNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.15 * s, 0.24 * s, 7), bodyMat.clone());
	tNeck.position.set(0, 2.20 * s, 0);
	group.add(tNeck);

	// ── TORSO ────────────────────────────────────────────────────────────────
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.94 * s, 0.68 * s, 0.58 * s), bodyMat);
	body.position.y = MECH_BODY_Y * s;
	body.castShadow = true;
	group.add(body);

	// 흉부 코어
	const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * s, 0), glowMat.clone());
	core.position.set(0, (MECH_BODY_Y + 0.06) * s, -0.31 * s);
	group.add(core);

	// 발광 트림
	for (const yOff of [0.24, -0.22]) {
		const trim = new THREE.Mesh(new THREE.BoxGeometry(0.90 * s, 0.025 * s, 0.025 * s), glowMat.clone());
		trim.position.set(0, (MECH_BODY_Y + yOff) * s, -0.31 * s);
		group.add(trim);
	}

	// 허리
	const waist = new THREE.Mesh(new THREE.BoxGeometry(0.64 * s, 0.26 * s, 0.50 * s), bodyMat.clone());
	waist.position.y = 1.32 * s;
	group.add(waist);

	// ── WING SHOULDER SPIKES ──────────────────────────────────────────────────
	const wingGeo = new THREE.ConeGeometry(0.18 * s, 1.02 * s, 4);
	for (const [sx, rz] of [[-1, -Math.PI / 2], [1, Math.PI / 2]] as [number, number][]) {
		const wing = new THREE.Mesh(wingGeo, accentMat.clone());
		wing.position.set(sx * 0.96 * s, 1.96 * s, 0.05 * s);
		wing.rotation.z = rz;
		wing.castShadow = true;
		group.add(wing);
	}

	// ── ARM PIVOTS ────────────────────────────────────────────────────────────
	function makeTArm(side: number): THREE.Group {
		const arm = new THREE.Group();
		arm.position.set(side * 0.62 * s, 1.94 * s, 0);

		const ua = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.50 * s, 0.26 * s), bodyMat.clone());
		ua.position.y = -0.25 * s;
		ua.castShadow = true;
		arm.add(ua);

		const elbow = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.14 * s, 0.32 * s), accentMat.clone());
		elbow.position.y = -0.52 * s;
		arm.add(elbow);

		const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 0.46 * s, 0.28 * s), bodyMat.clone());
		forearm.position.y = -0.78 * s;
		arm.add(forearm);

		// 캐논 배럴 (발광)
		const can = new THREE.Mesh(new THREE.CylinderGeometry(0.058 * s, 0.078 * s, 0.46 * s, 6), glowMat.clone());
		can.position.set(0, -1.08 * s, -0.24 * s);
		can.rotation.x = Math.PI / 2;
		arm.add(can);

		return arm;
	}

	// ── LEG PIVOTS ────────────────────────────────────────────────────────────
	function makeTLeg(side: number): THREE.Group {
		const leg = new THREE.Group();
		leg.position.set(side * 0.25 * s, 1.22 * s, 0);

		const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.30 * s, 0.54 * s, 0.30 * s), bodyMat.clone());
		thigh.position.y = -0.27 * s;
		thigh.castShadow = true;
		leg.add(thigh);

		const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.18 * s, 0.22 * s), accentMat.clone());
		kneePad.position.set(0, -0.55 * s, -0.06 * s);
		leg.add(kneePad);

		const greave = new THREE.Mesh(new THREE.BoxGeometry(0.29 * s, 0.62 * s, 0.34 * s), bodyMat.clone());
		greave.position.y = -0.86 * s;
		leg.add(greave);

		// 스러스터 노즐 (다리 뒤)
		const thr = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.065 * s, 0.14 * s, 6), glowMat.clone());
		thr.position.set(0, -1.12 * s, 0.20 * s);
		leg.add(thr);

		const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.12 * s, 0.46 * s), bodyMat.clone());
		foot.position.set(0, -1.16 * s, -0.06 * s);
		leg.add(foot);

		return leg;
	}

	const leftArm = makeTArm(-1);
	const rightArm = makeTArm(1);
	group.add(leftArm, rightArm);

	const leftLeg = makeTLeg(-1);
	const rightLeg = makeTLeg(1);
	group.add(leftLeg, rightLeg);

	// 힙 아머
	const hip = new THREE.Mesh(new THREE.BoxGeometry(0.68 * s, 0.16 * s, 0.50 * s), accentMat.clone());
	hip.position.y = 1.24 * s;
	group.add(hip);

	return { group, parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: MECH_BODY_Y * s } };
}

// ─────────────────────────────────────────────────────────────────────────────
//  적 동물형 로봇 (이족보행 포식자 메카)
//  얼굴: -Z / 발 밑면: y=0 / 사납고 강렬한 디자인
// ─────────────────────────────────────────────────────────────────────────────
export function createAnimalRobotModel(
	bodyColor: number,
	accentColor: number,
	s: number = 1
): { group: THREE.Group; parts: MechParts3D } {
	const group = new THREE.Group();

	const bodyMat = new THREE.MeshStandardMaterial({
		color: bodyColor,
		roughness: 0.62,
		metalness: 0.58,
		emissive: new THREE.Color(bodyColor).multiplyScalar(0.06)
	});
	const accentMat = new THREE.MeshStandardMaterial({
		color: accentColor,
		roughness: 0.35,
		metalness: 0.72,
		emissive: new THREE.Color(accentColor).multiplyScalar(0.25)
	});
	const eyeMat = new THREE.MeshStandardMaterial({
		color: 0xff2200,
		emissive: new THREE.Color(0xff0000),
		emissiveIntensity: 2.8,
		roughness: 0.08
	});
	const toothMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.3, metalness: 0.2 });
	const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8, metalness: 0.4 });

	// ── HEAD (낮게 앞으로 뻗은 동물 주둥이, -Z 방향) ──────────────────────
	const head = new THREE.Group();
	head.position.set(0, 2.05 * s, -0.10 * s); // 약간 앞으로
	group.add(head);

	// 두개골
	const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.36 * s, 0.44 * s), bodyMat.clone());
	skull.castShadow = true;
	head.add(skull);

	// 주둥이 (앞으로 길게 뻗음, -Z)
	const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.22 * s, 0.36 * s), bodyMat.clone());
	snout.position.set(0, -0.06 * s, -0.38 * s);
	head.add(snout);

	// 아래턱 (열려있는 느낌)
	const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.10 * s, 0.30 * s), darkMat.clone());
	jaw.position.set(0, -0.16 * s, -0.36 * s);
	head.add(jaw);

	// 이빨 (위)
	for (let i = -1; i <= 1; i++) {
		const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025 * s, 0.10 * s, 4), toothMat.clone());
		tooth.position.set(i * 0.08 * s, -0.12 * s, -0.52 * s);
		tooth.rotation.x = Math.PI;
		head.add(tooth);
	}

	// 눈 센서 (발광, 양쪽)
	for (const ex of [-0.14, 0.14]) {
		const eye = new THREE.Mesh(new THREE.BoxGeometry(0.10 * s, 0.08 * s, 0.05 * s), eyeMat.clone());
		eye.position.set(ex * s, 0.06 * s, -0.23 * s);
		head.add(eye);
	}

	// 귀 (뾰족한 뿔 스파이크)
	for (const ex of [-1, 1]) {
		const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055 * s, 0.28 * s, 4), accentMat.clone());
		ear.position.set(ex * 0.18 * s, 0.28 * s, 0.02 * s);
		ear.rotation.z = ex * 0.3;
		head.add(ear);
	}

	// ── NECK (굵고 짧음) ─────────────────────────────────────────────────────
	const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.16 * s, 0.22 * s, 6), bodyMat.clone());
	neck.position.set(0, 1.87 * s, -0.04 * s);
	group.add(neck);

	// ── TORSO (앞으로 숙인 짐승 체형) ───────────────────────────────────────
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.72 * s, 0.58 * s, 0.60 * s), bodyMat);
	body.position.y = 1.58 * s;
	body.castShadow = true;
	group.add(body);

	// 등 아머 (등 위에 날카로운 핀)
	for (let i = 0; i < 3; i++) {
		const dorsal = new THREE.Mesh(
			new THREE.ConeGeometry(0.04 * s, 0.24 * s, 4),
			accentMat.clone()
		);
		dorsal.position.set(0, (1.92 + i * 0.10) * s, (0.22 - i * 0.06) * s);
		group.add(dorsal);
	}

	// 복부 아머 플레이트
	for (let i = 0; i < 2; i++) {
		const ab = new THREE.Mesh(new THREE.BoxGeometry(0.52 * s, 0.10 * s, 0.48 * s), accentMat.clone());
		ab.position.set(0, (1.36 + i * 0.14) * s, 0);
		group.add(ab);
	}

	// 허리
	const waist = new THREE.Mesh(new THREE.BoxGeometry(0.58 * s, 0.22 * s, 0.48 * s), darkMat.clone());
	waist.position.y = 1.24 * s;
	group.add(waist);

	// ── ARM PIVOTS (어깨에서 피벗, 발톱 팔) ─────────────────────────────────
	//  pivot y=1.75*s → 발 (fist) = y=-1.0*s → world 0.75*s (공중)
	function makeAnimalArm(side: number): THREE.Group {
		const arm = new THREE.Group();
		arm.position.set(side * 0.44 * s, 1.75 * s, 0);

		// 상완 (굵고 짧음)
		const ua = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.44 * s, 0.26 * s), bodyMat.clone());
		ua.position.y = -0.22 * s;
		ua.castShadow = true;
		arm.add(ua);

		// 팔꿈치 스파이크
		const espike = new THREE.Mesh(new THREE.ConeGeometry(0.06 * s, 0.22 * s, 4), accentMat.clone());
		espike.position.set(0, -0.46 * s, 0.16 * s);
		espike.rotation.x = Math.PI / 2;
		arm.add(espike);

		// 전완
		const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.40 * s, 0.24 * s), bodyMat.clone());
		forearm.position.y = -0.70 * s;
		arm.add(forearm);

		// 발톱 (3개)
		for (let ci = -1; ci <= 1; ci++) {
			const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04 * s, 0.22 * s, 4), darkMat.clone());
			claw.position.set(ci * 0.07 * s, -0.98 * s, -0.12 * s);
			claw.rotation.x = -0.4;
			arm.add(claw);
		}

		return arm;
	}

	// ── LEG PIVOTS (고관절 피벗, 발 밑 y=0) ─────────────────────────────────
	//  pivot y=1.05*s → foot center y=-0.99*s → foot bottom =-1.05*s → world 0 ✓
	function makeAnimalLeg(side: number): THREE.Group {
		const leg = new THREE.Group();
		leg.position.set(side * 0.24 * s, 1.05 * s, 0);

		// 허벅지 (넓고 강함)
		const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.48 * s, 0.30 * s), bodyMat.clone());
		thigh.position.y = -0.24 * s;
		thigh.castShadow = true;
		leg.add(thigh);

		// 무릎 (역방향 느낌, 발목 높이 조정)
		const knee = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.14 * s, 0.26 * s), accentMat.clone());
		knee.position.y = -0.50 * s;
		leg.add(knee);

		// 하퇴
		const shin = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.48 * s, 0.28 * s), darkMat.clone());
		shin.position.y = -0.76 * s;
		leg.add(shin);

		// 발 (앞쪽 발톱 포함)
		const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.12 * s, 0.40 * s), bodyMat.clone());
		foot.position.set(0, -0.99 * s, -0.08 * s);
		leg.add(foot);

		// 발톱 (앞, 2개)
		for (const fx of [-0.08, 0.08]) {
			const ftclaw = new THREE.Mesh(new THREE.ConeGeometry(0.03 * s, 0.16 * s, 4), darkMat.clone());
			ftclaw.position.set(fx * s, -0.98 * s, -0.28 * s);
			ftclaw.rotation.x = -0.6;
			leg.add(ftclaw);
		}

		return leg;
	}

	const leftArm = makeAnimalArm(-1);
	const rightArm = makeAnimalArm(1);
	group.add(leftArm, rightArm);

	const leftLeg = makeAnimalLeg(-1);
	const rightLeg = makeAnimalLeg(1);
	group.add(leftLeg, rightLeg);

	// 힙 아머
	const hip = new THREE.Mesh(new THREE.BoxGeometry(0.56 * s, 0.14 * s, 0.42 * s), bodyMat.clone());
	hip.position.y = 1.08 * s;
	group.add(hip);

	return { group, parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: MECH_BODY_Y * s } };
}

// ═════════════════════════════════════════════════════════════════════════════
//  8단계 진화 모델 (form 0~8)
//  form 0: 네모 상자만 → form 8: 캐논 장착 궁극 전투 메카
// ═════════════════════════════════════════════════════════════════════════════

export function formForLevel(lv: number): number {
	if (lv >= 20) return 8;
	if (lv >= 17) return 7;
	if (lv >= 14) return 6;
	if (lv >= 11) return 5;
	if (lv >= 9)  return 4;
	if (lv >= 7)  return 3;
	if (lv >= 5)  return 2;
	if (lv >= 3)  return 1;
	return 0;
}

const FORM_STYLE = [
	{ body: 0x777777, accent: 0x999999, emissive: 0.00, glowInt: 0.15 },
	{ body: 0x556677, accent: 0x8899bb, emissive: 0.02, glowInt: 0.35 },
	{ body: 0x1155bb, accent: 0x3388dd, emissive: 0.06, glowInt: 1.0  },
	{ body: 0x1144cc, accent: 0x3399ff, emissive: 0.12, glowInt: 1.8  },
	{ body: 0x0033bb, accent: 0x00ccff, emissive: 0.20, glowInt: 2.6  },
	{ body: 0x0022aa, accent: 0x00ddff, emissive: 0.28, glowInt: 3.4  },
	{ body: 0xdd6600, accent: 0xffcc00, emissive: 0.50, glowInt: 4.5  },
	{ body: 0xcc2200, accent: 0xff8800, emissive: 0.80, glowInt: 5.5  },
	{ body: 0xaa0000, accent: 0xff3300, emissive: 1.20, glowInt: 7.0  },
];

export function createEvolvedModel(form: number, s: number): { group: THREE.Group; parts: MechParts3D } {
	const f = Math.min(form, 8);
	const st = FORM_STYLE[f];
	const group = new THREE.Group();
	const bodyMat = new THREE.MeshStandardMaterial({ color: st.body, roughness: 0.50, metalness: 0.65, emissive: new THREE.Color(st.body), emissiveIntensity: st.emissive });
	const accentMat = new THREE.MeshStandardMaterial({ color: st.accent, roughness: 0.25, metalness: 0.80, emissive: new THREE.Color(st.accent), emissiveIntensity: st.glowInt });
	const head = new THREE.Group();
	const leftArm  = new THREE.Group();
	const rightArm = new THREE.Group();
	const leftLeg  = new THREE.Group();
	const rightLeg = new THREE.Group();

	// ── form 0: 단순한 큐브 ──────────────────────────────────────────────────
	if (f === 0) {
		const cube = new THREE.Mesh(new THREE.BoxGeometry(0.80 * s, 1.0 * s, 0.80 * s), bodyMat);
		cube.position.y = 0.50 * s; cube.castShadow = true; group.add(cube);
		[head, leftArm, rightArm, leftLeg, rightLeg].forEach(g => group.add(g));
		return { group, parts: { head, body: cube, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: 0.50 * s } };
	}

	// ── form 1: 큐브 + 조그만 머리 + 팔 돌기 ────────────────────────────────
	if (f === 1) {
		const cube = new THREE.Mesh(new THREE.BoxGeometry(0.80 * s, 0.90 * s, 0.80 * s), bodyMat);
		cube.position.y = 0.55 * s; cube.castShadow = true; group.add(cube);
		const hm = new THREE.Mesh(new THREE.BoxGeometry(0.30 * s, 0.22 * s, 0.30 * s), bodyMat.clone());
		head.position.y = 1.06 * s; head.add(hm); group.add(head);
		for (const [side, ag] of [[-1, leftArm], [1, rightArm]] as [number, THREE.Group][]) {
			ag.position.set(side * 0.45 * s, 0.68 * s, 0);
			const st2 = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.18 * s, 0.18 * s), bodyMat.clone());
			st2.castShadow = true; ag.add(st2); group.add(ag);
		}
		group.add(leftLeg); group.add(rightLeg);
		return { group, parts: { head, body: cube, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: 0.55 * s } };
	}

	// ── form 2~8 공통 바디 ───────────────────────────────────────────────────
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.78 * s, 0.60 * s, 0.50 * s), bodyMat);
	body.position.y = MECH_BODY_Y * s; body.castShadow = true; group.add(body);

	// 머리
	head.position.y = 2.40 * s; group.add(head);
	const hW = f >= 4 ? 0.40 * s : 0.32 * s;
	const helm2 = new THREE.Mesh(new THREE.BoxGeometry(hW, hW * 0.95, hW * 0.95), bodyMat.clone());
	helm2.castShadow = true; head.add(helm2);
	if (f >= 3) {
		const vm = new THREE.MeshStandardMaterial({ color: st.accent, emissive: new THREE.Color(st.accent), emissiveIntensity: Math.max(1.5, st.glowInt * 0.55), roughness: 0.04 });
		const vi = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.07 * s, 0.06 * s), vm);
		vi.position.set(0, -0.02 * s, -hW * 0.52); head.add(vi);
	}
	if (f >= 6) {
		const gm = new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: new THREE.Color(0xffcc00), emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.85 });
		for (const sx of [-1, 1]) {
			const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.36 * s, 0.04 * s), gm.clone());
			fin.position.set(sx * 0.10 * s, 0.30 * s, -hW * 0.42); fin.rotation.z = sx * 0.40; head.add(fin);
		}
	}
	if (f >= 4) { const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * s, 0.13 * s, 0.22 * s, 7), bodyMat.clone()); neck.position.y = 2.14 * s; group.add(neck); }
	if (f >= 4) { const waist = new THREE.Mesh(new THREE.BoxGeometry(0.58 * s, 0.18 * s, 0.44 * s), bodyMat.clone()); waist.position.y = 1.28 * s; group.add(waist); }
	if (f >= 5) {
		const wm = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.42, metalness: 0.52 });
		const cp = new THREE.Mesh(new THREE.BoxGeometry(0.50 * s, 0.50 * s, 0.08 * s), wm);
		cp.position.set(0, MECH_BODY_Y * s + 0.04 * s, -0.27 * s); group.add(cp);
		const ht = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.16 * s, 0.04 * s),
			new THREE.MeshStandardMaterial({ color: st.accent, emissive: new THREE.Color(st.accent), emissiveIntensity: 0.9, roughness: 0.12 }));
		ht.position.set(0, MECH_BODY_Y * s + 0.04 * s, -0.29 * s); group.add(ht);
	}

	// 팔
	const aLen = f <= 3 ? 0.40 : f <= 5 ? 0.58 : 0.72;
	const aW = f <= 3 ? 0.14 : 0.18;
	for (const [side, ag] of [[-1, leftArm], [1, rightArm]] as [number, THREE.Group][]) {
		ag.position.set(side * 0.46 * s, MECH_BODY_Y * s, 0); group.add(ag);
		const up = new THREE.Mesh(new THREE.BoxGeometry(aW * s, aLen * s, aW * s), bodyMat.clone());
		up.position.y = -(aLen / 2) * s; up.castShadow = true; ag.add(up);
		if (f >= 5) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.22 * s, 0.26 * s), accentMat.clone()); sp.position.y = -0.06 * s; ag.add(sp); }
		if (f >= 4) {
			const fr = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.26 * s, 0.14 * s), bodyMat.clone());
			fr.position.y = -(aLen + 0.13) * s; ag.add(fr);
			if (f >= 5) {
				const fist2 = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.16 * s, 0.20 * s), accentMat.clone());
				fist2.position.set(0, -(aLen + 0.29) * s, -0.02 * s); ag.add(fist2);
			}
		}
	}

	// 다리
	if (f >= 3) {
		const lLen = f === 3 ? 0.28 : f === 4 ? 0.55 : f <= 6 ? 0.80 : 0.92;
		for (const [side, lg] of [[-1, leftLeg], [1, rightLeg]] as [number, THREE.Group][]) {
			lg.position.set(side * 0.18 * s, (1.15 - lLen * 0.5) * s, 0); group.add(lg);
			const th = new THREE.Mesh(new THREE.BoxGeometry(0.20 * s, lLen * s, 0.20 * s), bodyMat.clone());
			th.position.y = -(lLen / 2) * s; th.castShadow = true; lg.add(th);
			if (f >= 6) { const kn = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.14 * s, 0.22 * s), accentMat.clone()); kn.position.set(0, -(lLen * 0.38) * s, -0.06 * s); lg.add(kn); }
			if (f >= 5) { const ft = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.12 * s, 0.28 * s), bodyMat.clone()); ft.position.set(0, -(lLen + 0.04) * s, -0.04 * s); lg.add(ft); }
		}
	} else { group.add(leftLeg); group.add(rightLeg); }

	// 날개 (form 7+)
	if (f >= 7) {
		const wm2 = new THREE.MeshStandardMaterial({ color: st.accent, roughness: 0.25, metalness: 0.88, emissive: new THREE.Color(st.accent), emissiveIntensity: 0.55 });
		for (const sx of [-1, 1]) {
			for (let wi = 0; wi < 2; wi++) {
				const wing = new THREE.Mesh(new THREE.BoxGeometry(0.09 * s, (0.85 - wi * 0.2) * s, (0.55 + wi * 0.1) * s), wm2.clone());
				wing.position.set(sx * (0.52 + wi * 0.12) * s, (MECH_BODY_Y + 0.1 - wi * 0.25) * s, (0.22 + wi * 0.08) * s);
				wing.rotation.z = sx * (0.32 + wi * 0.18); group.add(wing);
			}
		}
	}

	// 숄더 캐논 (form 8)
	if (f >= 8) {
		const dm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55, metalness: 0.85 });
		const bm = new THREE.MeshStandardMaterial({ color: st.accent, emissive: new THREE.Color(st.accent), emissiveIntensity: 2.5, roughness: 0.06 });
		for (const sx of [-1, 1]) {
			const mn = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.14 * s, 0.40 * s), dm.clone());
			mn.position.set(sx * 0.62 * s, (MECH_BODY_Y + 0.25) * s, -0.05 * s); group.add(mn);
			const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.50 * s, 6), bm.clone());
			br.rotation.x = -Math.PI / 2; br.position.set(sx * 0.62 * s, (MECH_BODY_Y + 0.25) * s, -0.30 * s); group.add(br);
		}
	}

	// ── 발 좌표 보정: 모든 메시의 bbox minY를 0으로 맞춤 ────────────────────
	{
		group.updateMatrixWorld(true);
		const bbox = new THREE.Box3().setFromObject(group);
		const minY = bbox.min.y;
		if (Math.abs(minY) > 0.01) {
			for (const child of [...group.children]) {
				child.position.y -= minY;
			}
		}
	}

	return { group, parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: body.position.y } };
}

// ─────────────────────────────────────────────────────────────────────────────
//  보스 동물형 모델 (5종)
//  모두 얼굴 -Z 방향, 발 밑면 y=0 기준
// ─────────────────────────────────────────────────────────────────────────────
export function createBossAnimalModel(
	type: 'bear' | 'wolf' | 'dragon' | 'tiger' | 'ironlord',
	bodyColor: number,
	accentColor: number,
	s: number = 1
): { group: THREE.Group; parts: MechParts3D } {
	switch (type) {
		case 'bear':    return _makeBear(bodyColor, accentColor, s);
		case 'wolf':    return _makeWolf(bodyColor, accentColor, s);
		case 'dragon':  return _makeDragon(bodyColor, accentColor, s);
		case 'tiger':   return _makeTiger(bodyColor, accentColor, s);
		case 'ironlord':return _makeIronLord(bodyColor, accentColor, s);
	}
}

function _bossFloor(group: THREE.Group, body: THREE.Object3D, head: THREE.Object3D, leftArm: THREE.Object3D, rightArm: THREE.Object3D, leftLeg: THREE.Object3D, rightLeg: THREE.Object3D, bodyMat: THREE.MeshStandardMaterial, accentMat: THREE.MeshStandardMaterial): { group: THREE.Group; parts: MechParts3D } {
	group.updateMatrixWorld(true);
	const bbox = new THREE.Box3().setFromObject(group);
	const minY = bbox.min.y;
	if (Math.abs(minY) > 0.01) {
		for (const c of [...group.children]) c.position.y -= minY;
	}
	return { group, parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: body.position.y } };
}

/** 곰 보스: 넓은 통 몸통, 둥근 머리, 커다란 앞발 */
function _makeBear(bc: number, ac: number, s: number) {
	const group = new THREE.Group();
	const bodyMat  = new THREE.MeshStandardMaterial({ color: bc, roughness: 0.55, metalness: 0.60, emissive: new THREE.Color(bc).multiplyScalar(0.07) });
	const accentMat = new THREE.MeshStandardMaterial({ color: ac, roughness: 0.30, metalness: 0.75, emissive: new THREE.Color(ac).multiplyScalar(0.30) });
	const eyeMat    = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: new THREE.Color(0xff0000), emissiveIntensity: 3.0, roughness: 0.05 });

	// 몸통: 넓고 두꺼운 배럴
	const body = new THREE.Mesh(new THREE.BoxGeometry(1.9 * s, 1.6 * s, 1.3 * s), bodyMat.clone());
	body.position.y = 2.0 * s; body.castShadow = true; group.add(body);
	// 가슴 장갑
	const chest = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 0.8 * s, 0.25 * s), accentMat.clone());
	chest.position.set(0, 2.3 * s, -0.65 * s); group.add(chest);

	// 머리: 둥근 머리 + 귀
	const head = new THREE.Group(); head.position.set(0, 3.4 * s, -0.1 * s); group.add(head);
	const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62 * s, 12, 10), bodyMat.clone());
	skull.castShadow = true; head.add(skull);
	for (const ex of [-0.44, 0.44]) {
		const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.22 * s, 8), accentMat.clone());
		ear.position.set(ex * s, 0.52 * s, 0); head.add(ear);
	}
	// 주둥이
	const snout = new THREE.Mesh(new THREE.BoxGeometry(0.56 * s, 0.40 * s, 0.30 * s), accentMat.clone());
	snout.position.set(0, -0.18 * s, -0.55 * s); head.add(snout);
	for (const ex of [-0.18, 0.18]) {
		const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 6, 6), eyeMat.clone());
		eye.position.set(ex * s, 0.18 * s, -0.62 * s); head.add(eye);
	}

	// 팔: 거대한 클럭
	function makeArm(sx: number) {
		const arm = new THREE.Group(); arm.position.set(sx * 1.15 * s, 2.2 * s, 0); group.add(arm);
		const upper = new THREE.Mesh(new THREE.BoxGeometry(0.60 * s, 1.10 * s, 0.60 * s), bodyMat.clone());
		upper.position.y = -0.45 * s; upper.castShadow = true; arm.add(upper);
		const claw = new THREE.Mesh(new THREE.BoxGeometry(0.70 * s, 0.40 * s, 0.70 * s), accentMat.clone());
		claw.position.set(0, -1.10 * s, -0.08 * s); arm.add(claw);
		for (let i = 0; i < 3; i++) {
			const nail = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, 0.30 * s, 5), accentMat.clone());
			nail.rotation.x = Math.PI / 2; nail.position.set((i - 1) * 0.22 * s, -1.28 * s, -0.40 * s); arm.add(nail);
		}
		return arm;
	}
	const leftArm = makeArm(-1); const rightArm = makeArm(1);

	// 다리: 두꺼운 기둥
	function makeLeg(sx: number) {
		const leg = new THREE.Group(); leg.position.set(sx * 0.62 * s, 1.1 * s, 0); group.add(leg);
		const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.65 * s, 1.0 * s, 0.65 * s), bodyMat.clone());
		thigh.position.y = -0.35 * s; thigh.castShadow = true; leg.add(thigh);
		const foot  = new THREE.Mesh(new THREE.BoxGeometry(0.70 * s, 0.25 * s, 0.80 * s), accentMat.clone());
		foot.position.set(0, -1.0 * s, -0.10 * s); leg.add(foot);
		return leg;
	}
	const leftLeg = makeLeg(-1); const rightLeg = makeLeg(1);

	return _bossFloor(group, body, head, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat);
}

/** 늑대 보스: 날렵한 몸체, 긴 주둥이, 사족 자세 */
function _makeWolf(bc: number, ac: number, s: number) {
	const group = new THREE.Group();
	const bodyMat  = new THREE.MeshStandardMaterial({ color: bc, roughness: 0.50, metalness: 0.65, emissive: new THREE.Color(bc).multiplyScalar(0.06) });
	const accentMat = new THREE.MeshStandardMaterial({ color: ac, roughness: 0.28, metalness: 0.78, emissive: new THREE.Color(ac).multiplyScalar(0.35) });
	const eyeMat    = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: new THREE.Color(0xff8800), emissiveIntensity: 3.5, roughness: 0.04 });

	// 날렵한 몸통
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.80 * s, 0.90 * s, 1.80 * s), bodyMat.clone());
	body.position.y = 1.80 * s; body.castShadow = true; group.add(body);
	// 등 갈기/등판
	const mane = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.30 * s, 1.60 * s), accentMat.clone());
	mane.position.set(0, 2.28 * s, 0); group.add(mane);

	// 머리: 주둥이 긴 형태
	const head = new THREE.Group(); head.position.set(0, 2.20 * s, -1.10 * s); group.add(head);
	const skull = new THREE.Mesh(new THREE.BoxGeometry(0.66 * s, 0.62 * s, 0.76 * s), bodyMat.clone());
	skull.castShadow = true; head.add(skull);
	// 귀 (삼각형)
	for (const ex of [-0.28, 0.28]) {
		const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14 * s, 0.42 * s, 4), accentMat.clone());
		ear.position.set(ex * s, 0.50 * s, 0.10 * s); head.add(ear);
	}
	// 주둥이
	const snout = new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 0.28 * s, 0.55 * s), accentMat.clone());
	snout.position.set(0, -0.14 * s, -0.60 * s); head.add(snout);
	for (const ex of [-0.14, 0.14]) {
		const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085 * s, 6, 6), eyeMat.clone());
		eye.position.set(ex * s, 0.16 * s, -0.52 * s); head.add(eye);
	}

	// 앞다리 (대각선 자세)
	function makeFrontLeg(sx: number) {
		const leg = new THREE.Group(); leg.position.set(sx * 0.45 * s, 1.55 * s, -0.85 * s); group.add(leg);
		const upper = new THREE.Mesh(new THREE.BoxGeometry(0.30 * s, 0.90 * s, 0.30 * s), bodyMat.clone());
		upper.position.y = -0.35 * s; upper.rotation.x = -0.22; upper.castShadow = true; leg.add(upper);
		const foot  = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.18 * s, 0.46 * s), accentMat.clone());
		foot.position.set(0, -0.90 * s, -0.15 * s); leg.add(foot);
		return leg;
	}
	const leftArm = makeFrontLeg(-1); const rightArm = makeFrontLeg(1);

	// 뒷다리
	function makeBackLeg(sx: number) {
		const leg = new THREE.Group(); leg.position.set(sx * 0.45 * s, 1.35 * s, 0.80 * s); group.add(leg);
		const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 1.0 * s, 0.30 * s), bodyMat.clone());
		thigh.position.y = -0.40 * s; thigh.castShadow = true; leg.add(thigh);
		const foot   = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.18 * s, 0.56 * s), accentMat.clone());
		foot.position.set(0, -1.05 * s, 0.16 * s); leg.add(foot);
		return leg;
	}
	const leftLeg = makeBackLeg(-1); const rightLeg = makeBackLeg(1);

	// 꼬리
	const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * s, 0.04 * s, 1.20 * s, 6), accentMat.clone());
	tail.position.set(0, 2.0 * s, 1.10 * s); tail.rotation.x = -0.55; group.add(tail);

	return _bossFloor(group, body, head, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat);
}

/** 드래곤 보스: 긴 목, 날개, 용 머리 */
function _makeDragon(bc: number, ac: number, s: number) {
	const group = new THREE.Group();
	const bodyMat  = new THREE.MeshStandardMaterial({ color: bc, roughness: 0.45, metalness: 0.70, emissive: new THREE.Color(bc).multiplyScalar(0.08) });
	const accentMat = new THREE.MeshStandardMaterial({ color: ac, roughness: 0.22, metalness: 0.82, emissive: new THREE.Color(ac).multiplyScalar(0.40) });
	const eyeMat    = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: new THREE.Color(0x00ffcc), emissiveIntensity: 4.0, roughness: 0.03 });
	const wingMat   = new THREE.MeshStandardMaterial({ color: ac, roughness: 0.35, metalness: 0.60, transparent: true, opacity: 0.85, side: THREE.DoubleSide });

	// 몸통
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.90 * s, 1.0 * s, 1.60 * s), bodyMat.clone());
	body.position.y = 2.0 * s; body.castShadow = true; group.add(body);
	// 등 등뼈
	for (let i = 0; i < 5; i++) {
		const spine = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, 0.30 * s, 5), accentMat.clone());
		spine.position.set(0, 2.56 * s, (0.55 - i * 0.25) * s); group.add(spine);
	}

	// 긴 목 + 머리
	const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 0.9 * s, 8), bodyMat.clone());
	neck.position.set(0, 2.7 * s, -0.75 * s); neck.rotation.x = 0.35; group.add(neck);

	const head = new THREE.Group(); head.position.set(0, 3.2 * s, -1.3 * s); group.add(head);
	const skull = new THREE.Mesh(new THREE.BoxGeometry(0.58 * s, 0.44 * s, 0.88 * s), bodyMat.clone());
	skull.castShadow = true; head.add(skull);
	// 뿔
	for (const ex of [-0.22, 0.22]) {
		const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08 * s, 0.50 * s, 5), accentMat.clone());
		horn.position.set(ex * s, 0.46 * s, 0.10 * s); horn.rotation.z = ex > 0 ? 0.25 : -0.25; head.add(horn);
	}
	const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.22 * s, 0.62 * s), accentMat.clone());
	jaw.position.set(0, -0.32 * s, -0.30 * s); head.add(jaw);
	for (const ex of [-0.16, 0.16]) {
		const eye = new THREE.Mesh(new THREE.SphereGeometry(0.10 * s, 6, 6), eyeMat.clone());
		eye.position.set(ex * s, 0.12 * s, -0.45 * s); head.add(eye);
	}

	// 날개
	for (const sx of [-1, 1]) {
		const wingBase = new THREE.Group(); wingBase.position.set(sx * 0.5 * s, 2.4 * s, 0.2 * s); group.add(wingBase);
		const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.90 * s, 0.60 * s), wingMat.clone());
		seg1.position.set(sx * 0.50 * s, 0, 0); seg1.rotation.z = sx * 0.45; wingBase.add(seg1);
		const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.70 * s, 0.45 * s), wingMat.clone());
		seg2.position.set(sx * 1.05 * s, 0.15 * s, 0); seg2.rotation.z = sx * 0.70; wingBase.add(seg2);
		const seg3 = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.50 * s, 0.35 * s), wingMat.clone());
		seg3.position.set(sx * 1.55 * s, 0.28 * s, 0); seg3.rotation.z = sx * 0.90; wingBase.add(seg3);
	}

	// 다리
	function makeLeg(sx: number) {
		const leg = new THREE.Group(); leg.position.set(sx * 0.45 * s, 1.5 * s, 0); group.add(leg);
		const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.38 * s, 0.95 * s, 0.38 * s), bodyMat.clone());
		thigh.position.y = -0.40 * s; thigh.castShadow = true; leg.add(thigh);
		const claw  = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.20 * s, 0.60 * s), accentMat.clone());
		claw.position.set(0, -1.0 * s, -0.10 * s); leg.add(claw);
		return leg;
	}
	const leftArm = makeLeg(-1); const rightArm = makeLeg(1);
	const leftLeg  = makeLeg(-1); const rightLeg  = makeLeg(1);
	leftLeg.position.set(-0.45 * s, 1.5 * s, 0.60 * s);
	rightLeg.position.set(0.45 * s, 1.5 * s, 0.60 * s);

	// 꼬리
	for (let i = 0; i < 4; i++) {
		const seg = new THREE.Mesh(new THREE.BoxGeometry((0.30 - i * 0.05) * s, (0.22 - i * 0.03) * s, 0.35 * s), bodyMat.clone());
		seg.position.set(0, (2.0 - i * 0.10) * s, (0.95 + i * 0.35) * s); group.add(seg);
	}

	return _bossFloor(group, body, head, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat);
}

/** 호랑이 보스: 근육질 상체, 낮은 자세, 줄무늬 */
function _makeTiger(bc: number, ac: number, s: number) {
	const group = new THREE.Group();
	const bodyMat  = new THREE.MeshStandardMaterial({ color: bc, roughness: 0.52, metalness: 0.62, emissive: new THREE.Color(bc).multiplyScalar(0.07) });
	const accentMat = new THREE.MeshStandardMaterial({ color: ac, roughness: 0.32, metalness: 0.72, emissive: new THREE.Color(ac).multiplyScalar(0.28) });
	const eyeMat    = new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: new THREE.Color(0xffaa00), emissiveIntensity: 3.2, roughness: 0.05 });

	// 근육질 상체 (낮은 자세)
	const body = new THREE.Mesh(new THREE.BoxGeometry(1.50 * s, 1.0 * s, 1.20 * s), bodyMat.clone());
	body.position.y = 1.7 * s; body.castShadow = true; group.add(body);
	// 줄무늬
	for (let i = 0; i < 4; i++) {
		const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.52 * s, 0.12 * s, 0.12 * s), accentMat.clone());
		stripe.position.set(0, (1.9 + i * 0.22) * s, -0.55 * s); group.add(stripe);
	}
	// 어깨 근육
	for (const sx of [-1, 1]) {
		const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 8, 6), accentMat.clone());
		shoulder.position.set(sx * 0.85 * s, 2.1 * s, -0.1 * s); group.add(shoulder);
	}

	// 머리
	const head = new THREE.Group(); head.position.set(0, 2.5 * s, -0.75 * s); group.add(head);
	const skull = new THREE.Mesh(new THREE.BoxGeometry(0.78 * s, 0.62 * s, 0.72 * s), bodyMat.clone());
	skull.castShadow = true; head.add(skull);
	// 귀
	for (const ex of [-0.33, 0.33]) {
		const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13 * s, 0.30 * s, 4), accentMat.clone());
		ear.position.set(ex * s, 0.40 * s, 0.05 * s); head.add(ear);
	}
	const snout = new THREE.Mesh(new THREE.BoxGeometry(0.50 * s, 0.38 * s, 0.36 * s), accentMat.clone());
	snout.position.set(0, -0.12 * s, -0.50 * s); head.add(snout);
	for (const ex of [-0.20, 0.20]) {
		const eye = new THREE.Mesh(new THREE.SphereGeometry(0.10 * s, 6, 6), eyeMat.clone());
		eye.position.set(ex * s, 0.12 * s, -0.44 * s); head.add(eye);
	}

	// 거대한 앞발 (낮은 자세에서 앞으로)
	function makeFrontArm(sx: number) {
		const arm = new THREE.Group(); arm.position.set(sx * 0.9 * s, 1.75 * s, -0.4 * s); group.add(arm);
		const upper = new THREE.Mesh(new THREE.BoxGeometry(0.50 * s, 0.95 * s, 0.50 * s), bodyMat.clone());
		upper.position.y = -0.32 * s; upper.castShadow = true; arm.add(upper);
		const paw   = new THREE.Mesh(new THREE.BoxGeometry(0.56 * s, 0.26 * s, 0.62 * s), accentMat.clone());
		paw.position.set(0, -0.90 * s, -0.16 * s); arm.add(paw);
		for (let i = 0; i < 3; i++) {
			const nail = new THREE.Mesh(new THREE.ConeGeometry(0.06 * s, 0.22 * s, 4), accentMat.clone());
			nail.rotation.x = Math.PI / 2; nail.position.set((i - 1) * 0.18 * s, -1.05 * s, -0.40 * s); arm.add(nail);
		}
		return arm;
	}
	const leftArm = makeFrontArm(-1); const rightArm = makeFrontArm(1);

	function makeBackLeg(sx: number) {
		const leg = new THREE.Group(); leg.position.set(sx * 0.52 * s, 1.3 * s, 0.55 * s); group.add(leg);
		const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.46 * s, 1.10 * s, 0.40 * s), bodyMat.clone());
		thigh.position.y = -0.42 * s; thigh.castShadow = true; leg.add(thigh);
		const paw   = new THREE.Mesh(new THREE.BoxGeometry(0.48 * s, 0.22 * s, 0.70 * s), accentMat.clone());
		paw.position.set(0, -1.08 * s, 0.15 * s); leg.add(paw);
		return leg;
	}
	const leftLeg = makeBackLeg(-1); const rightLeg = makeBackLeg(1);

	return _bossFloor(group, body, head, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat);
}

/** 아이언 로드 보스: 거대 사각형 기계 군주, 스파이크, 두꺼운 다리 */
function _makeIronLord(bc: number, ac: number, s: number) {
	const group = new THREE.Group();
	const bodyMat  = new THREE.MeshStandardMaterial({ color: bc, roughness: 0.35, metalness: 0.85, emissive: new THREE.Color(bc).multiplyScalar(0.05) });
	const accentMat = new THREE.MeshStandardMaterial({ color: ac, roughness: 0.18, metalness: 0.92, emissive: new THREE.Color(ac).multiplyScalar(0.45) });
	const glowMat   = new THREE.MeshStandardMaterial({ color: ac, emissive: new THREE.Color(ac), emissiveIntensity: 4.5, roughness: 0.04 });
	const eyeMat    = glowMat.clone();

	// 거대 직육면체 몸통
	const body = new THREE.Mesh(new THREE.BoxGeometry(2.10 * s, 1.80 * s, 1.40 * s), bodyMat.clone());
	body.position.y = 2.3 * s; body.castShadow = true; group.add(body);
	// 코어 빛
	const core = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 8, 8), glowMat.clone());
	core.position.set(0, 2.3 * s, -0.72 * s); group.add(core);
	// 어깨 스파이크
	for (const sx of [-1, 1]) {
		for (let i = 0; i < 3; i++) {
			const spike = new THREE.Mesh(new THREE.ConeGeometry(0.10 * s, 0.55 * s, 5), accentMat.clone());
			spike.position.set(sx * 1.18 * s, (2.7 + i * 0.3) * s, (0.15 - i * 0.20) * s);
			spike.rotation.z = sx * (0.4 + i * 0.1); group.add(spike);
		}
	}

	// 머리: 각진 헬멧
	const head = new THREE.Group(); head.position.set(0, 3.85 * s, 0); group.add(head);
	const helm = new THREE.Mesh(new THREE.BoxGeometry(1.10 * s, 0.80 * s, 0.90 * s), bodyMat.clone());
	helm.castShadow = true; head.add(helm);
	// 바이저
	const visor = new THREE.Mesh(new THREE.BoxGeometry(0.80 * s, 0.22 * s, 0.12 * s), glowMat.clone());
	visor.position.set(0, 0.0, -0.50 * s); head.add(visor);
	for (const ex of [-0.22, 0.22]) {
		const eye = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.14 * s, 0.14 * s), eyeMat.clone());
		eye.position.set(ex * s, 0.0, -0.50 * s); head.add(eye);
	}
	// 뿔
	for (const ex of [-0.40, 0.40]) {
		const horn = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.60 * s, 0.14 * s), accentMat.clone());
		horn.position.set(ex * s, 0.60 * s, 0); head.add(horn);
	}

	// 거대 팔
	function makeArm(sx: number) {
		const arm = new THREE.Group(); arm.position.set(sx * 1.20 * s, 2.6 * s, 0); group.add(arm);
		const upper = new THREE.Mesh(new THREE.BoxGeometry(0.60 * s, 1.40 * s, 0.60 * s), bodyMat.clone());
		upper.position.y = -0.55 * s; upper.castShadow = true; arm.add(upper);
		const fist  = new THREE.Mesh(new THREE.BoxGeometry(0.80 * s, 0.70 * s, 0.70 * s), accentMat.clone());
		fist.position.y = -1.40 * s; arm.add(fist);
		// 캐논 포신
		const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.10 * s, 0.80 * s, 6), glowMat.clone());
		barrel.rotation.x = -Math.PI / 2; barrel.position.set(0, -1.40 * s, -0.55 * s); arm.add(barrel);
		return arm;
	}
	const leftArm = makeArm(-1); const rightArm = makeArm(1);

	// 두꺼운 기둥 다리
	function makeLeg(sx: number) {
		const leg = new THREE.Group(); leg.position.set(sx * 0.65 * s, 1.4 * s, 0); group.add(leg);
		const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.80 * s, 1.40 * s, 0.80 * s), bodyMat.clone());
		thigh.position.y = -0.55 * s; thigh.castShadow = true; leg.add(thigh);
		const boot  = new THREE.Mesh(new THREE.BoxGeometry(0.90 * s, 0.35 * s, 1.00 * s), accentMat.clone());
		boot.position.set(0, -1.40 * s, -0.08 * s); leg.add(boot);
		return leg;
	}
	const leftLeg = makeLeg(-1); const rightLeg = makeLeg(1);

	return _bossFloor(group, body, head, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat);
}
