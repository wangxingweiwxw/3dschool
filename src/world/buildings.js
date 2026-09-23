import * as THREE from "three";
import { expandedRecipes } from './expandedBuildings.js';
import { box, cylinder, sphere, signBoard, colliderFromSize, voxelMat } from "./voxel.js";

function gatePillars(region, w) {
  const rot = region.rotation || 0;
  const dx = Math.cos(rot) * (w / 2);
  const dz = Math.sin(rot) * (w / 2);
  return [
    colliderFromSize(region.x - dx, region.z - dz, 1.5, 1.6, 0.1),
    colliderFromSize(region.x + dx, region.z + dz, 1.5, 1.6, 0.1),
  ];
}

function root(x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot || 0;
  return g;
}

export function buildCeremonialGate(region, c) {
  const g = root(region.x, region.z, region.rotation);
  const w = region.w ?? 10;
  box(g, w, 1.2, 1.1, c.cream, 0, 3.4, 0);
  box(g, 1.3, 4.2, 1.3, c.brick, -w / 2 + 0.4, 2.1, 0);
  box(g, 1.3, 4.2, 1.3, c.brick, w / 2 - 0.4, 2.1, 0);
  box(g, 1.6, 0.5, 1.6, c.cream, -w / 2 + 0.4, 4.4, 0);
  box(g, 1.6, 0.5, 1.6, c.cream, w / 2 - 0.4, 4.4, 0);
  box(g, w + 0.6, 0.35, 1.4, c.brickDark, 0, 4.15, 0);
  signBoard(g, region.label || "复旦大学", w * 0.72, 0.7, 0, 3.45, 0.58);
  signBoard(g, region.label || "复旦大学", w * 0.72, 0.7, 0, 3.45, -0.58, Math.PI);
  box(g, 0.35, 1.1, 2.2, c.creamDark, -w / 2 + 1.4, 0.55, 0);
  box(g, 0.35, 1.1, 2.2, c.creamDark, w / 2 - 1.4, 0.55, 0);
  return { group: g, colliders: gatePillars(region, w) };
}

export function buildSmallGate(region, c) {
  const g = root(region.x, region.z, region.rotation);
  const w = region.w ?? 7;
  box(g, 1.1, 3.2, 1.1, c.cream, -w / 2, 1.6, 0);
  box(g, 1.1, 3.2, 1.1, c.cream, w / 2, 1.6, 0);
  box(g, w + 1.4, 0.9, 1.0, c.cream, 0, 3.3, 0);
  box(g, w + 1.6, 0.28, 1.15, c.brick, 0, 3.85, 0);
  signBoard(g, region.label || "复旦大学", w * 0.8, 0.55, 0, 3.35, 0.52);
  return { group: g, colliders: gatePillars(region, w) };
}

function buildHallRoof(parent, w, d) {
  // Build the footprint directly: scaling and then rotating a four-sided cone
  // produces skewed eaves on rectangular buildings and a single pyramid apex.
  const width = w + 0.9;
  const depth = d + 0.9;
  const halfW = width / 2;
  const halfD = depth / 2;
  const eaveY = 4.525;
  const rise = 1.65;
  const hipInset = Math.min(depth * 0.32, width * 0.3);
  const ridgeHalf = halfW - hipInset;
  const vertices = [
    [-halfW, 0, halfD], [halfW, 0, halfD],
    [halfW, 0, -halfD], [-halfW, 0, -halfD],
    [-ridgeHalf, rise, 0], [ridgeHalf, rise, 0],
  ];
  // Separate face vertices retain crisp hip edges; each trapezoid is coplanar.
  const faces = [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 1, 2, 5, 3, 0, 4, 0, 3, 2, 0, 2, 1];
  const positions = [];
  const uvs = [];
  for (const index of faces) {
    const [x, y, z] = vertices[index];
    positions.push(x, y + eaveY, z);
    uvs.push(x / width + 0.5, z / depth + 0.5);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // Keep UVs so the mesh remains compatible with the campus static batching.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const roof = new THREE.Mesh(geometry, voxelMat(0x627168));
  roof.name = 'xianghui-hipped-roof';
  roof.castShadow = true;
  roof.receiveShadow = true;
  parent.add(roof);

  // A thin fascia seats the roof on the walls, with an even overhang all round.
  box(parent, width, 0.18, depth, 0x58635b, 0, eaveY - 0.09, 0);
  box(parent, width - 0.1, 0.09, depth - 0.1, 0xd5d1bb, 0, eaveY - 0.225, 0);
  box(parent, ridgeHalf * 2 + 0.22, 0.16, 0.24, 0x839084, 0, eaveY + rise + 0.035, 0);

  const addHip = (corner, ridge) => {
    const start = new THREE.Vector3(...vertices[corner]);
    const end = new THREE.Vector3(...vertices[ridge]);
    const direction = end.clone().sub(start);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, direction.length(), 6), voxelMat(0x778578));
    cap.position.copy(start.add(end).multiplyScalar(0.5));
    cap.position.y += eaveY + 0.025;
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    cap.castShadow = true;
    cap.receiveShadow = true;
    parent.add(cap);
  };
  [[0, 4], [3, 4], [1, 5], [2, 5]].forEach(([corner, ridge]) => addHip(corner, ridge));

  // Shallow tile courses follow all four roof planes, including the end hips.
  // Shared materials allow these details to collapse into the existing batches.
  for (let row = 1; row < 12; row += 1) {
    const t = row / 12;
    const y = eaveY + rise * t + 0.018;
    for (const side of [-1, 1]) {
      const course = box(parent, width - hipInset * 2 * t - 0.07, 0.022, 0.045, 0x58685e,
        0, y, side * halfD * (1 - t), { noShadow: true });
      course.rotation.x = side * Math.atan2(rise, halfD);
      const endCourse = box(parent, 0.045, 0.022, depth * (1 - t) - 0.07, 0x58685e,
        side * (halfW - hipInset * t), y, 0, { noShadow: true });
      endCourse.rotation.z = -side * Math.atan2(rise, hipInset);
    }
  }
}

export function buildClassicalHall(region, c) {
  const g = root(region.x, region.z, region.rotation);
  const w = region.w ?? 14;
  const d = region.d ?? 10;
  box(g, w, 4.2, d, c.cream, 0, 2.2, 0);
  buildHallRoof(g, w, d);
  for(let i=-3;i<=3;i++){if(i===0)continue;box(g,.9,1.65,.1,0x875b44,i*1.8,2.35,d/2+.06,{nightEmission:'window'});box(g,.07,1.65,.12,c.cream,i*1.8,2.35,d/2+.12);box(g,.9,.08,.12,c.cream,i*1.8,2.35,d/2+.12);}
  box(g,8.6,.28,2.1,c.cream,0,3.8,d/2+.2);
  signBoard(g,'相 辉 堂',3.4,.6,0,3.15,d/2+.15);
  for (let i = -2; i <= 2; i += 1) {
    cylinder(g, 0.18, 0.2, 2.6, c.white, i * 1.5, 1.4, d / 2 + 0.35, 8);
  }
  box(g, w * 0.7, 0.25, 1.8, c.plaza, 0, 0.2, d / 2 + 1.3);
  box(g, 2.2, 0.18, 2.4, c.plaza, 0, 0.12, d / 2 + 2.6);
  box(g, 1.8, 2.4, 0.12, 0x725747, 0, 1.5, d / 2 + 0.08);
  return { group: g, collider: colliderFromSize(region.x, region.z, w, d) };
}

export function buildTwinTower(region, c) {
  const g = root(region.x, region.z, region.rotation);
  const h = region.h ?? 16;
  const gap = 3.2;
  const tw = 3.4;
  const td = 3.4;
  for (const side of [-1, 1]) {
    box(g, tw, h, td, c.glass, side * gap, h / 2, 0, {nightEmission:'glass'});
    box(g, tw + 0.25, 0.35, td + 0.25, c.white, side * gap, h + 0.1, 0);
    for (let y = 1.4; y < h - 0.6; y += 1.15) {
      box(g, tw + 0.04, 0.08, td + 0.04, c.white, side * gap, y, 0, { noShadow: true });
    }
    box(g, 0.18, h, 0.18, c.white, side * gap - tw / 2, h / 2, -td / 2);
    box(g, 0.18, h, 0.18, c.white, side * gap + tw / 2, h / 2, td / 2);
  }
  box(g, gap * 2 - 0.4, 4.6, 2.4, c.glassDeep, 0, 8.4, 0, {nightEmission:'glass'});
  box(g, 9.6, 2.2, 6.2, c.cream, 0, 1.15, 0);
  box(g, 10.2, 0.28, 6.8, c.plaza, 0, 0.14, 0);
  return { group: g, collider: colliderFromSize(region.x, region.z, 10.4, 6.8) };
}

export function buildClockTower(region, c) {
  const g = root(region.x, region.z, region.rotation);
  const h = region.h ?? 12;
  box(g, 3.2, h, 3.2, c.brick, 0, h / 2, 0);
  box(g, 3.6, 1.2, 3.6, c.cream, 0, h - 1.4, 0);
  box(g, 2.4, 2.0, 0.12, c.cream, 0, h - 1.5, 1.72);
  cylinder(g, 0.08, 0.08, 0.7, c.ink, 0, h - 1.35, 1.8, 6);
  cylinder(g, 0.08, 0.08, 0.45, c.ink, 0.18, h - 1.5, 1.8, 6).rotation.z = 1.1;
  box(g, 4.0, 0.7, 4.0, c.brickDark, 0, h + 0.2, 0);
  box(g, 1.2, 1.8, 1.2, c.brick, 0, h + 1.4, 0);
  box(g, 0.35, 1.4, 0.35, c.gold, 0, h + 2.6, 0);
  return { group: g, collider: colliderFromSize(region.x, region.z, 3.6, 3.6) };
}

export function buildShop(region, c) {
  const g = root(region.x, region.z, region.rotation);
  const w = region.w ?? 6;
  const d = region.d ?? 5;
  box(g, w, 3.1, d, c.shop, 0, 1.55, 0);
  box(g, w + 0.8, 0.35, d + 0.8, c.white, 0, 3.25, 0);
  box(g, w + 1.2, 0.18, 1.4, c.yellow ?? 0xffe14a, 0, 2.55, d / 2 + 0.4);
  box(g, 1.4, 1.8, 0.12, c.cream, 0, 1.1, d / 2 + 0.08);
  box(g, 0.7, 0.7, 0.08, c.gold, -1.5, 1.8, d / 2 + 0.08, {nightEmission:'window'});
  box(g, 0.7, 0.7, 0.08, c.gold, 1.5, 1.8, d / 2 + 0.08, {nightEmission:'window'});
  signBoard(g, region.label || "复旦文创", w * 0.7, 0.45, 0, 2.85, d / 2 + 0.22);
  return { group: g, collider: colliderFromSize(region.x, region.z, w, d) };
}

export function buildWhiteHouse(region, c) {
  const g = root(region.x, region.z, region.rotation);
  const w = region.w ?? 8;
  const d = region.d ?? 6;
  box(g, w, 3.4, d, c.white, 0, 1.7, 0);
  box(g, w + 0.6, 0.5, d + 0.6, c.roof, 0, 3.55, 0);
  cylinder(g, 0.16, 0.16, 2.2, c.white, -1.2, 1.2, d / 2 + 0.3, 8);
  cylinder(g, 0.16, 0.16, 2.2, c.white, 1.2, 1.2, d / 2 + 0.3, 8);
  box(g, 3.2, 0.28, 1.6, c.plaza, 0, 0.16, d / 2 + 1.1);
  return { group: g, collider: colliderFromSize(region.x, region.z, w, d) };
}

export function buildAcademic(region, c) {
  const g = root(region.x, region.z, region.rotation);
  const w = region.w ?? 8;
  const d = region.d ?? 5;
  const h = region.h ?? 4.5;
  box(g, w, h, d, c.cream, 0, h / 2, 0);
  box(g, w + 0.4, 0.35, d + 0.4, c.roof, 0, h + 0.1, 0);
  for (let i = -1; i <= 1; i += 1) {
    box(g, 0.7, 0.7, 0.08, c.glass, i * 1.6, 2.1, d / 2 + 0.05, {nightEmission:'window'});
  }
  return { group: g, collider: colliderFromSize(region.x, region.z, w, d) };
}

export function buildWayfinding(region, c) {
  const g = root(region.x, region.z, region.rotation);
  box(g, 0.22, 3.2, 0.22, c.wood ?? 0x8a5a32, 0, 1.6, 0);
  box(g, 2.6, 0.7, 0.16, c.cream, 0.4, 2.6, 0);
  signBoard(g, region.label || "FUDAN", 2.3, 0.42, 0.4, 2.62, 0.1);
  return { group: g, collider: null };
}

export const recipes = {
  ...expandedRecipes,
  "ceremonial-gate": buildCeremonialGate,
  "small-gate": buildSmallGate,
  "classical-hall": buildClassicalHall,
  "twin-tower": buildTwinTower,
  "clock-tower": buildClockTower,
  shop: buildShop,
  "white-house": buildWhiteHouse,
  academic: buildAcademic,
  wayfinding: buildWayfinding,
};
