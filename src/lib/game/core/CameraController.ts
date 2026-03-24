import * as THREE from 'three';

export class CameraController {
	private camera: THREE.PerspectiveCamera;
	private offset = new THREE.Vector3(0, 16, 14);
	private lookUp = new THREE.Vector3(0, 1.5, 0);
	private speed = 4;

	constructor(camera: THREE.PerspectiveCamera) {
		this.camera = camera;
	}

	update(delta: number, target: THREE.Vector3): void {
		const desired = new THREE.Vector3().addVectors(target, this.offset);
		this.camera.position.lerp(desired, 1 - Math.exp(-this.speed * delta));
		this.camera.lookAt(target.x + this.lookUp.x, target.y + this.lookUp.y, target.z + this.lookUp.z);
	}
}
