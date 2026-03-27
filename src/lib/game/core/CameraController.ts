import * as THREE from 'three';

export class CameraController {
	private camera: THREE.PerspectiveCamera;
	private offset = new THREE.Vector3(0, 26, 20); // 줄보: 더 높고 멀리
	private lookUp = new THREE.Vector3(0, 1.5, 0);
	private speed = 4;

	private shakeIntensity = 0;
	private shakeDuration  = 0;
	private shakeTimer     = 0;
	private shakeOffset    = new THREE.Vector3();

	constructor(camera: THREE.PerspectiveCamera) {
		this.camera = camera;
	}

	/** 화면 흔들림 트리거. intensity: 강도(단위), duration: 지속(ms) */
	shake(intensity: number, duration: number): void {
		this.shakeIntensity = intensity;
		this.shakeDuration  = duration;
		this.shakeTimer     = duration;
	}

	update(delta: number, target: THREE.Vector3): void {
		const ms = delta * 1000;

		if (this.shakeTimer > 0) {
			this.shakeTimer = Math.max(0, this.shakeTimer - ms);
			const t = this.shakeTimer / this.shakeDuration;
			const mag = this.shakeIntensity * t;
			this.shakeOffset.set(
				(Math.random() * 2 - 1) * mag,
				(Math.random() * 2 - 1) * mag * 0.5,
				(Math.random() * 2 - 1) * mag * 0.4
			);
		} else {
			this.shakeOffset.set(0, 0, 0);
		}

		const desired = new THREE.Vector3().addVectors(target, this.offset).add(this.shakeOffset);
		this.camera.position.lerp(desired, 1 - Math.exp(-this.speed * delta));
		this.camera.lookAt(target.x + this.lookUp.x, target.y + this.lookUp.y, target.z + this.lookUp.z);
	}
}
