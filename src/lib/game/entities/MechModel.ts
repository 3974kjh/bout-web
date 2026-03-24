import * as THREE from 'three';

export interface MechParts3D {
	head: THREE.Mesh;
	body: THREE.Mesh;
	leftArm: THREE.Mesh;
	rightArm: THREE.Mesh;
	leftLeg: THREE.Mesh;
	rightLeg: THREE.Mesh;
	bodyMat: THREE.MeshStandardMaterial;
	accentMat: THREE.MeshStandardMaterial;
}

export function createMechModel(
	bodyColor: number,
	accentColor: number,
	s: number = 1
): { group: THREE.Group; parts: MechParts3D } {
	const group = new THREE.Group();

	const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, metalness: 0.4 });
	const accentMat = new THREE.MeshStandardMaterial({
		color: accentColor,
		roughness: 0.45,
		metalness: 0.5
	});
	const visorMat = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		emissive: 0xaaddff,
		emissiveIntensity: 0.6
	});

	const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.45 * s, 0.5 * s), accentMat);
	head.position.y = 1.6 * s;
	head.castShadow = true;

	const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38 * s, 0.12 * s, 0.06 * s), visorMat);
	visor.position.set(0, 1.62 * s, -0.26 * s);

	const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 0.8 * s, 0.5 * s), bodyMat);
	body.position.y = 1.0 * s;
	body.castShadow = true;

	const armGeo = new THREE.BoxGeometry(0.28 * s, 0.6 * s, 0.28 * s);
	const leftArm = new THREE.Mesh(armGeo, accentMat);
	leftArm.position.set(-0.56 * s, 1.0 * s, 0);
	leftArm.castShadow = true;
	const rightArm = new THREE.Mesh(armGeo, accentMat);
	rightArm.position.set(0.56 * s, 1.0 * s, 0);
	rightArm.castShadow = true;

	const legGeo = new THREE.BoxGeometry(0.3 * s, 0.55 * s, 0.3 * s);
	const leftLeg = new THREE.Mesh(legGeo, bodyMat);
	leftLeg.position.set(-0.22 * s, 0.275 * s, 0);
	leftLeg.castShadow = true;
	const rightLeg = new THREE.Mesh(legGeo, bodyMat);
	rightLeg.position.set(0.22 * s, 0.275 * s, 0);
	rightLeg.castShadow = true;

	group.add(head, visor, body, leftArm, rightArm, leftLeg, rightLeg);

	return { group, parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat } };
}

/**
 * Transformed mech: larger, angular, with shoulder spikes, arm cannons,
 * glowing chest core and thruster nozzles. Orange-red color scheme.
 */
export function createTransformedMechModel(): { group: THREE.Group; parts: MechParts3D } {
	const group = new THREE.Group();
	const s = 1.18;

	const bodyMat = new THREE.MeshStandardMaterial({
		color: 0xaa2800,
		roughness: 0.28,
		metalness: 0.72
	});
	const accentMat = new THREE.MeshStandardMaterial({
		color: 0xff5500,
		roughness: 0.18,
		metalness: 0.82,
		emissive: new THREE.Color(0xff2200),
		emissiveIntensity: 0.35
	});
	const glowMat = new THREE.MeshStandardMaterial({
		color: 0xffdd00,
		emissive: new THREE.Color(0xffcc00),
		emissiveIntensity: 2.2,
		roughness: 0.08,
		metalness: 0.95
	});
	const visorMat = new THREE.MeshStandardMaterial({
		color: 0xff8800,
		emissive: new THREE.Color(0xff4400),
		emissiveIntensity: 3.5
	});

	// Head
	const head = new THREE.Mesh(new THREE.BoxGeometry(0.52 * s, 0.52 * s, 0.52 * s), bodyMat);
	head.position.y = 1.68 * s;
	head.castShadow = true;

	// Crest spike on top of head
	const crest = new THREE.Mesh(new THREE.ConeGeometry(0.06 * s, 0.55 * s, 4), accentMat);
	crest.position.set(0, 2.12 * s, 0);

	// Visor
	const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.15 * s, 0.06), visorMat);
	visor.position.set(0, 1.71 * s, -0.29 * s);

	// Body
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.98 * s, 0.88 * s, 0.56 * s), bodyMat);
	body.position.y = 1.03 * s;
	body.castShadow = true;

	// Glowing chest crystal
	const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * s, 0), glowMat);
	core.position.set(0, 1.1 * s, -0.31 * s);

	// Glow trim lines on body front
	const trim1 = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.03, 0.02), glowMat);
	trim1.position.set(0, 1.5 * s, -0.31 * s);
	const trim2 = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.03, 0.02), glowMat);
	trim2.position.set(0, 0.62 * s, -0.31 * s);

	// Shoulder spike wings — ConeGeometry with diamond cross-section, rotated sideways
	const wingGeo = new THREE.ConeGeometry(0.18 * s, 0.9 * s, 4);
	const leftWing = new THREE.Mesh(wingGeo, accentMat);
	leftWing.position.set(-0.8 * s, 1.44 * s, 0.06 * s);
	leftWing.rotation.z = -Math.PI / 2; // tip points left
	leftWing.castShadow = true;
	const rightWing = new THREE.Mesh(wingGeo, accentMat);
	rightWing.position.set(0.8 * s, 1.44 * s, 0.06 * s);
	rightWing.rotation.z = Math.PI / 2; // tip points right
	rightWing.castShadow = true;

	// Arms
	const armGeo = new THREE.BoxGeometry(0.33 * s, 0.67 * s, 0.33 * s);
	const leftArm = new THREE.Mesh(armGeo, accentMat);
	leftArm.position.set(-0.64 * s, 1.02 * s, 0);
	leftArm.castShadow = true;
	const rightArm = new THREE.Mesh(armGeo, accentMat);
	rightArm.position.set(0.64 * s, 1.02 * s, 0);
	rightArm.castShadow = true;

	// Arm cannon barrels (glowing)
	const canGeo = new THREE.CylinderGeometry(0.065 * s, 0.085 * s, 0.44 * s, 6);
	const leftCan = new THREE.Mesh(canGeo, glowMat);
	leftCan.position.set(-0.64 * s, 0.62 * s, -0.25 * s);
	leftCan.rotation.x = Math.PI / 2;
	const rightCan = new THREE.Mesh(canGeo, glowMat);
	rightCan.position.set(0.64 * s, 0.62 * s, -0.25 * s);
	rightCan.rotation.x = Math.PI / 2;

	// Legs
	const legGeo = new THREE.BoxGeometry(0.35 * s, 0.59 * s, 0.35 * s);
	const leftLeg = new THREE.Mesh(legGeo, bodyMat);
	leftLeg.position.set(-0.25 * s, 0.3 * s, 0);
	leftLeg.castShadow = true;
	const rightLeg = new THREE.Mesh(legGeo, bodyMat);
	rightLeg.position.set(0.25 * s, 0.3 * s, 0);
	rightLeg.castShadow = true;

	// Thruster nozzles on legs
	const thrGeo = new THREE.CylinderGeometry(0.1 * s, 0.07 * s, 0.17 * s, 6);
	const leftThr = new THREE.Mesh(thrGeo, glowMat);
	leftThr.position.set(-0.25 * s, 0.04 * s, 0.19 * s);
	const rightThr = new THREE.Mesh(thrGeo, glowMat);
	rightThr.position.set(0.25 * s, 0.04 * s, 0.19 * s);

	group.add(
		head, crest, visor,
		body, core, trim1, trim2,
		leftWing, rightWing,
		leftArm, rightArm, leftCan, rightCan,
		leftLeg, rightLeg, leftThr, rightThr
	);

	return { group, parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat } };
}
