import * as THREE from "three";
import { box, sphere } from "../world/voxel.js";

export class ArcticFox {
  constructor() {
    this.group = new THREE.Group();
    this.speed = 5.6;
    this.runMul = 1.55;
    this.radius = 0.55;
    this.yaw = 0;
    this.bob = 0;
    this.build();
    this.group.scale.setScalar(1.45);
  }

  build() {
    const c = {
      fur: 0xf7f4f0,
      shade: 0xe8d8cc,
      pink: 0xffb3c7,
      ink: 0x2b1a12,
      pack: 0x3b6fd4,
      strap: 0x244a96,
    };
    const body = new THREE.Group();
    this.body = body;
    this.group.add(body);

    box(body, 0.58, 0.42, 0.78, c.fur, 0, 0.62, 0);
    box(body, 0.36, 0.34, 0.3, c.pack, 0, 0.86, -0.08);
    box(body, 0.08, 0.28, 0.42, c.strap, -0.22, 0.72, 0.02);
    box(body, 0.08, 0.28, 0.42, c.strap, 0.22, 0.72, 0.02);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.95, 0.42);
    body.add(this.head);
    box(this.head, 0.52, 0.42, 0.48, c.fur, 0, 0, 0);
    box(this.head, 0.22, 0.16, 0.2, c.shade, 0, -0.08, 0.28);
    box(this.head, 0.08, 0.07, 0.08, c.ink, 0, -0.06, 0.38);
    box(this.head, 0.08, 0.08, 0.06, c.ink, -0.14, 0.06, 0.22);
    box(this.head, 0.08, 0.08, 0.06, c.ink, 0.14, 0.06, 0.22);
    box(this.head, 0.16, 0.2, 0.1, c.fur, -0.18, 0.28, -0.04);
    box(this.head, 0.16, 0.2, 0.1, c.fur, 0.18, 0.28, -0.04);
    box(this.head, 0.08, 0.1, 0.06, c.pink, -0.18, 0.26, 0.02);
    box(this.head, 0.08, 0.1, 0.06, c.pink, 0.18, 0.26, 0.02);

    this.legFL = box(body, 0.12, 0.32, 0.12, c.fur, -0.18, 0.18, 0.22);
    this.legFR = box(body, 0.12, 0.32, 0.12, c.fur, 0.18, 0.18, 0.22);
    this.legBL = box(body, 0.12, 0.32, 0.12, c.fur, -0.18, 0.18, -0.24);
    this.legBR = box(body, 0.12, 0.32, 0.12, c.fur, 0.18, 0.18, -0.24);

    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.7, -0.46);
    body.add(this.tail);
    box(this.tail, 0.18, 0.18, 0.42, c.fur, 0, 0.08, -0.16);
    sphere(this.tail, 0.16, c.shade, 0, 0.1, -0.38, 6);

    this.group.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
  }

  setPose(x, z, yaw) {
    this.group.position.set(x, 0, z);
    this.yaw = yaw;
    this.group.rotation.y = yaw;
  }

  update(dt, move, running) {
    const len = Math.hypot(move.x, move.z);
    if (len > 0.01) {
      const target = Math.atan2(move.x, move.z);
      const diff = Math.atan2(Math.sin(target-this.yaw),Math.cos(target-this.yaw));
      this.yaw += diff * (1 - Math.pow(0.001, dt));
      this.group.rotation.y = this.yaw;
      this.bob += dt * (running ? 14 : 10);
      const swing = Math.sin(this.bob) * 0.45;
      this.legFL.rotation.x = swing;
      this.legBR.rotation.x = swing;
      this.legFR.rotation.x = -swing;
      this.legBL.rotation.x = -swing;
      this.tail.rotation.y = Math.sin(this.bob * 0.8) * 0.25;
      this.body.position.y = Math.abs(Math.sin(this.bob)) * 0.06;
    } else {
      this.legFL.rotation.x = 0;
      this.legFR.rotation.x = 0;
      this.legBL.rotation.x = 0;
      this.legBR.rotation.x = 0;
      this.body.position.y *= 0.8;
    }
  }
}
