import * as THREE from 'three';
import type { StageQuery } from '$lib/domain/types';

interface Platform {
	mesh: THREE.Mesh;
	box: THREE.Box3;
	topY: number;
}

const W = 60;
const D = 50;
// Player can auto-step-up platforms shorter than this (units).
// All current platforms are 1.5–2 m → require a jump.
const STEP_UP = 0.4;

export class TrainingPlanet implements StageQuery {
	bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 };
	private platforms: Platform[] = [];

	constructor(scene: THREE.Scene) {
		this.createGround(scene);
		this.createPlatforms(scene);
		this.createWalls(scene);
		this.createDecorations(scene);
	}

	getGroundHeight(x: number, z: number, currentY: number): number {
		let best = 0;
		for (const p of this.platforms) {
			if (
				x >= p.box.min.x &&
				x <= p.box.max.x &&
				z >= p.box.min.z &&
				z <= p.box.max.z &&
				p.topY <= currentY + STEP_UP
			) {
				best = Math.max(best, p.topY);
			}
		}
		return best;
	}

	/**
	 * Resolve horizontal movement against platform walls.
	 * Returns the closest valid (x, z) the mover can actually occupy.
	 */
	resolveMovement(
		fromX: number,
		fromZ: number,
		toX: number,
		toZ: number,
		y: number,
		radius = 0.45
	): { x: number; z: number } {
		let rx = toX;
		let rz = toZ;

		for (const p of this.platforms) {
			// Skip: platform is low enough to step onto
			if (p.topY <= y + STEP_UP) continue;
			// Skip: mover is already above this platform
			if (y >= p.topY) continue;

			const ex0 = p.box.min.x - radius;
			const ex1 = p.box.max.x + radius;
			const ez0 = p.box.min.z - radius;
			const ez1 = p.box.max.z + radius;

			if (rx > ex0 && rx < ex1 && rz > ez0 && rz < ez1) {
				// New position is inside expanded box — resolve per axis
				const fromXIn = fromX > ex0 && fromX < ex1;
				const fromZIn = fromZ > ez0 && fromZ < ez1;

				if (!fromXIn) rx = fromX; // came from X side → block X
				if (!fromZIn) rz = fromZ; // came from Z side → block Z

				// If still inside after partial resolution, cancel both
				if (rx > ex0 && rx < ex1 && rz > ez0 && rz < ez1) {
					rx = fromX;
					rz = fromZ;
				}
			}
		}

		return { x: rx, z: rz };
	}

	private createGround(scene: THREE.Scene): void {
		const geo = new THREE.PlaneGeometry(W, D);
		const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.85 });
		const mesh = new THREE.Mesh(geo, mat);
		mesh.rotation.x = -Math.PI / 2;
		mesh.receiveShadow = true;
		scene.add(mesh);

		const grid = new THREE.GridHelper(Math.max(W, D), 30, 0x333355, 0x222244);
		(grid.material as THREE.Material).opacity = 0.35;
		(grid.material as THREE.Material).transparent = true;
		scene.add(grid);
	}

	private createPlatforms(scene: THREE.Scene): void {
		// [centerX, height, centerZ, width, depth]
		const defs: [number, number, number, number, number][] = [
			[-12, 1.5, -5, 6, 5],
			[12, 1.5, -5, 6, 5],
			[0, 2, -15, 8, 5],
			[-10, 1.5, 8, 5, 4],
			[10, 1.5, 8, 5, 4]
		];

		const mat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.7, metalness: 0.3 });
		const edgeMat = new THREE.MeshStandardMaterial({
			color: 0x667788,
			roughness: 0.5,
			metalness: 0.4
		});

		for (const [px, py, pz, pw, pd] of defs) {
			const geo = new THREE.BoxGeometry(pw, py, pd);
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.set(px, py / 2, pz);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			scene.add(mesh);

			const edgeGeo = new THREE.BoxGeometry(pw + 0.1, 0.08, pd + 0.1);
			const edge = new THREE.Mesh(edgeGeo, edgeMat);
			edge.position.set(px, py, pz);
			scene.add(edge);

			const box = new THREE.Box3().setFromObject(mesh);
			this.platforms.push({ mesh, box, topY: py });
		}
	}

	private createWalls(scene: THREE.Scene): void {
		const wallMat = new THREE.MeshStandardMaterial({
			color: 0x334455,
			roughness: 0.8,
			transparent: true,
			opacity: 0.25
		});
		const wallH = 3;

		const sides: [number, number, number, number, number][] = [
			[0, wallH / 2, -D / 2, W, wallH],
			[0, wallH / 2, D / 2, W, wallH],
			[-W / 2, wallH / 2, 0, wallH, D],
			[W / 2, wallH / 2, 0, wallH, D]
		];

		for (const [x, y, z, w, h] of sides) {
			const isZ = Math.abs(z) > Math.abs(x) - 1;
			const geo = new THREE.BoxGeometry(isZ ? w : 0.3, h, isZ ? 0.3 : w);
			const mesh = new THREE.Mesh(geo, wallMat);
			mesh.position.set(x, y, z);
			scene.add(mesh);
		}
	}

	private createDecorations(scene: THREE.Scene): void {
		const pillarMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.6, metalness: 0.3 });
		const positions: [number, number][] = [
			[-20, -20],
			[20, -20],
			[-20, 10],
			[20, 10],
			[0, 0]
		];

		for (const [x, z] of positions) {
			const geo = new THREE.CylinderGeometry(0.4, 0.5, 3, 8);
			const mesh = new THREE.Mesh(geo, pillarMat);
			mesh.position.set(x, 1.5, z);
			mesh.castShadow = true;
			scene.add(mesh);
		}

		const containerMat = new THREE.MeshStandardMaterial({ color: 0x885533, roughness: 0.7 });
		const containers: [number, number][] = [
			[-8, 5],
			[8, 5],
			[-15, -12],
			[15, -12]
		];
		for (const [x, z] of containers) {
			const geo = new THREE.BoxGeometry(1.2, 1, 0.8);
			const mesh = new THREE.Mesh(geo, containerMat);
			mesh.position.set(x, 0.5, z);
			mesh.castShadow = true;
			scene.add(mesh);
		}
	}
}
