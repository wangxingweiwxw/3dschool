import * as THREE from 'three';

// Shared movement rig for the human campus explorers. Models face +Z.
export class CampusWalker {
  constructor() {
    this.group = new THREE.Group();
    this.speed = 5.6;
    this.runMul = 1.55;
    this.radius = 0.55;
    this.yaw = 0;
    this.bob = 0;
    this.idleTime = 0;
    this.build();
    this.group.scale.setScalar(1.1);
  }

  setPose(x, z, yaw) {
    this.group.position.set(x, 0, z);
    this.yaw = yaw;
    this.group.rotation.y = yaw;
  }

  update(dt, move, running) {
    this.idleTime += dt;
    const walking = Math.hypot(move.x, move.z) > .01;
    if (walking) {
      const target = Math.atan2(move.x, move.z);
      const diff = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      this.yaw += diff * (1 - Math.pow(.001, dt));
      this.group.rotation.y = this.yaw;
      this.bob += dt * (running ? 15 : 10);
    }
    const blend = 1 - Math.exp(-dt * 16);
    const swing = walking ? Math.sin(this.bob) * (running ? .8 : .52) : 0;
    this.legs.forEach((leg, i) => { leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, i ? -swing : swing, blend); });
    this.arms.forEach((arm, i) => { arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, (i ? swing : -swing) * .8, blend); });
    const bounce = walking ? Math.abs(Math.sin(this.bob)) * (running ? .07 : .04) : Math.sin(this.idleTime * 2) * .012;
    this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, bounce, blend);
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, walking && running ? .09 : 0, blend);
    if (this.scarf) this.scarf.rotation.x = THREE.MathUtils.lerp(this.scarf.rotation.x, walking ? -.12 + Math.sin(this.bob) * .08 : 0, blend);
    if (this.bag) this.bag.rotation.z = THREE.MathUtils.lerp(this.bag.rotation.z, walking ? Math.sin(this.bob) * .08 : 0, blend);
  }
}
