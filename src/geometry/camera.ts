import { Matrix4 } from "./matrix4.js";
import { Vector3 } from "./vector3.js";

export interface CameraTarget {
  position: Vector3;
}

/** Perspective camera with the coordinate conventions used by JIT 2.0.1. */
export class Camera {
  projectionMatrix: Matrix4;
  position: Vector3;
  target: CameraTarget;
  up: Vector3;
  matrix: Matrix4;

  constructor(fieldOfView: number, aspect: number, near: number, far: number) {
    this.projectionMatrix = Matrix4.makePerspective(
      fieldOfView,
      aspect,
      near,
      far,
    );
    this.position = new Vector3();
    this.target = { position: new Vector3() };
    this.up = new Vector3(0, 1, 0);
    this.matrix = new Matrix4();
  }

  updateMatrix(): void {
    this.matrix.lookAt(this.position, this.target.position, this.up);
  }
}
