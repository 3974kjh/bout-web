import * as THREE from 'three';
import { Projectile } from './Projectile';

const MAX_POOLED_ENEMY = 160;

/**
 * 적 원거리 탄 전용 풀 — 공유 지오/머티리얼은 Projectile.recycle 시 유지.
 */
export class ProjectilePool {
	private readonly enemyFree: Projectile[] = [];

	acquireEnemy(
		scene: THREE.Scene,
		pos: THREE.Vector3,
		dir: THREE.Vector3,
		speed: number,
		damage: number,
		scale = 1
	): Projectile {
		const p = this.enemyFree.pop();
		if (p) {
			p.resetEnemy(scene, pos, dir, speed, damage, scale);
			return p;
		}
		return new Projectile(scene, pos, dir, speed, damage, 0xff4400, false, 0, scale, null);
	}

	releaseEnemy(p: Projectile, scene: THREE.Scene): void {
		p.recycleEnemy(scene);
		if (this.enemyFree.length < MAX_POOLED_ENEMY) {
			this.enemyFree.push(p);
		} else {
			p.dispose(scene);
		}
	}

	/** 재시작·엔진 destroy 시 풀에 쌓인 인스턴스까지 완전 dispose */
	clear(scene: THREE.Scene): void {
		for (const p of this.enemyFree) {
			p.dispose(scene);
		}
		this.enemyFree.length = 0;
	}
}
