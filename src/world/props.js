import * as THREE from "three";
import { box, cylinder, sphere, voxelMat } from "./voxel.js";

function hash(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function makeTree(species, c, scale = 1) {
  const g = new THREE.Group();
  const trunkH = 2.1;
  cylinder(g, .13, .27, 3.2, 0x75644a, 0, 1.6, 0, 6);
  const branch = cylinder(g, .07, .15, 1.4, 0x75644a, .35, 2.2, 0, 5);
  branch.rotation.z = -.7;
  const colors = species === 'cherry' ? [0xd9a9ae,0xedc3bd,0xf9d9c8,0xe7b4b6] : species === 'maple' ? [0xc67b43,0xe6a657,0xd5aa5d,0xd98b45] : [0x477251,0x5d8554,0x839956,0x668853];
  [[0,.8,0,1.55],[-1,.55,.1,1.13],[.85,.75,.4,1.28],[.2,1.65,-.15,1.18],[-.45,1.15,-.85,1.05]].forEach(([x,y,z,r],i)=>{
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),voxelMat(colors[i%4]));
    crown.position.set(x,trunkH+y,z);crown.scale.y=.82;crown.castShadow=true;crown.receiveShadow=true;g.add(crown);
  });
  g.scale.setScalar(scale);
  return g;
}

export function scatterGrove(region, c) {
  const group = new THREE.Group();
  const species = region.species || "cherry";
  const density = region.density ?? 0.35;
  const count = Math.max(3, Math.round(region.w * region.d * density * 0.18));
  for (let i = 0; i < count; i += 1) {
    const hx = hash(region.x + i, region.z + i * 3);
    const hz = hash(region.z + i * 2, region.x - i);
    const x = region.x - region.w / 2 + hx * region.w;
    const z = region.z - region.d / 2 + hz * region.d;
    const tree = makeTree(species, c, 0.75 + hx * 0.55);
    tree.position.set(x, 0, z);
    group.add(tree);
  }
  return group;
}

export function makeLamp(c) {
  const g = new THREE.Group();
  cylinder(g, 0.07, 0.09, 2.1, c.ink, 0, 1.05, 0, 6);
  box(g, 0.45, 0.28, 0.45, c.gold, 0, 2.2, 0, {nightEmission:'lamp'});
  return g;
}

export function makeBench(c) {
  const g = new THREE.Group();
  box(g, 1.4, 0.12, 0.42, c.creamDark, 0, 0.42, 0);
  box(g, 0.12, 0.42, 0.42, c.trunk, -0.55, 0.21, 0);
  box(g, 0.12, 0.42, 0.42, c.trunk, 0.55, 0.21, 0);
  return g;
}

export function makeBridge(region, c) {
  const g = new THREE.Group();
  g.position.set(region.x, 0, region.z);
  g.rotation.y = region.rotation || 0;
  const w = region.w ?? 6;
  const d = region.d ?? 2.2;
  box(g, w, 0.28, d, c.plaza, 0, 0.55, 0);
  box(g, w, 0.16, 0.16, c.cream, 0, 1.05, d / 2);
  box(g, w, 0.16, 0.16, c.cream, 0, 1.05, -d / 2);
  return g;
}

export function makeSwan(c) {
  const g = new THREE.Group();
  box(g, 0.46, 0.22, 0.28, c.white, 0, 0.16, 0);
  box(g, 0.16, 0.28, 0.14, c.white, 0.22, 0.32, 0);
  box(g, 0.08, 0.06, 0.06, c.gold, 0.32, 0.34, 0);
  return g;
}

export function makePetalSystem(count = 80) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = [];
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 1] = 2 + Math.random() * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    speeds.push(0.4 + Math.random() * 0.8);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffc1d8,
    size: 0.22,
    transparent: true,
    opacity: 0.85,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.speeds = speeds;
  return points;
}

export function stepPetals(points, dt) {
  const pos = points.geometry.attributes.position;
  const speeds = points.userData.speeds;
  for (let i = 0; i < pos.count; i += 1) {
    pos.array[i * 3 + 1] -= speeds[i] * dt;
    pos.array[i * 3] += Math.sin(pos.array[i * 3 + 1] + i) * dt * 0.3;
    if (pos.array[i * 3 + 1] < 0.3) {
      pos.array[i * 3 + 1] = 10;
      pos.array[i * 3] = (Math.random() - 0.5) * 90;
      pos.array[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
  }
  pos.needsUpdate = true;
}
