import * as THREE from 'three';

/** 유닛 스케일 기준 — mesh.scale로 탄 크기 반영 (드로우·할당 절감) */
export const SHARED_ENEMY_SPHERE = new THREE.SphereGeometry(1, 8, 6);

export const SHARED_PLAYER_MISSILE_CYL = new THREE.CylinderGeometry(0.08, 0.13, 0.65, 6);

const enemyMatState = { mat: null as THREE.MeshStandardMaterial | null, users: 0 };

export function acquireEnemyProjectileMaterial(): THREE.MeshStandardMaterial {
	if (!enemyMatState.mat) {
		enemyMatState.mat = new THREE.MeshStandardMaterial({
			color: 0xff4400,
			emissive: new THREE.Color(0xff4400),
			emissiveIntensity: 1.5,
			roughness: 0.12,
			metalness: 0.6
		});
	}
	enemyMatState.users++;
	return enemyMatState.mat;
}

export function releaseEnemyProjectileMaterial(): void {
	enemyMatState.users = Math.max(0, enemyMatState.users - 1);
	if (enemyMatState.users === 0 && enemyMatState.mat) {
		disposeMeshStandardTextures(enemyMatState.mat);
		enemyMatState.mat.dispose();
		enemyMatState.mat = null;
	}
}

type PlayerMatEntry = { users: number; mat: THREE.MeshStandardMaterial };
const playerMatByColor = new Map<number, PlayerMatEntry>();

export function acquirePlayerMeshProjectileMaterial(color: number): THREE.MeshStandardMaterial {
	let e = playerMatByColor.get(color);
	if (!e) {
		const c = new THREE.Color(color);
		e = {
			users: 0,
			mat: new THREE.MeshStandardMaterial({
				color,
				emissive: c.clone(),
				emissiveIntensity: 2.8,
				roughness: 0.12,
				metalness: 0.6
			})
		};
		playerMatByColor.set(color, e);
	}
	e.users++;
	return e.mat;
}

export function releasePlayerMeshProjectileMaterial(color: number): void {
	const e = playerMatByColor.get(color);
	if (!e) return;
	e.users = Math.max(0, e.users - 1);
	if (e.users === 0) {
		disposeMeshStandardTextures(e.mat);
		e.mat.dispose();
		playerMatByColor.delete(color);
	}
}

function disposeMeshStandardTextures(m: THREE.MeshStandardMaterial): void {
	const keys = [
		'map',
		'emissiveMap',
		'normalMap',
		'roughnessMap',
		'metalnessMap',
		'aoMap',
		'lightMap',
		'bumpMap',
		'alphaMap',
		'envMap'
	] as const;
	for (const k of keys) {
		const t = m[k];
		if (t && typeof (t as THREE.Texture).dispose === 'function') (t as THREE.Texture).dispose();
	}
}
