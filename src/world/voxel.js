import * as THREE from "three";

const materials = new Map();

export function voxelMat(hex, opts = {}) {
  const key = `${hex}-${opts.transparent ? 1 : 0}-${opts.opacity ?? 1}-${opts.nightEmission || ''}`;
  if (!materials.has(key)) {
    materials.set(
      key,
      new THREE.MeshLambertMaterial({
        color: hex,
        transparent: Boolean(opts.transparent),
        opacity: opts.opacity ?? 1,
        flatShading: true,
      }),
    );
  }
  const material = materials.get(key);
  if (opts.nightEmission) material.userData.nightEmission = opts.nightEmission;
  return material;
}

export function box(parent, w, h, d, hex, x, y, z, opts) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), voxelMat(hex, opts));
  mesh.position.set(x, y, z);
  mesh.castShadow = !opts?.noShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(parent, rTop, rBot, h, hex, x, y, z, segs = 8) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, segs),
    voxelMat(hex),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function sphere(parent, r, hex, x, y, z, segs = 8) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs), voxelMat(hex));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function makePixelText(text, { w = 256, h = 64, fill = "#2b1a12", bg = "#fff6df", size = 28 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fill;
  ctx.font = `900 ${size}px "ZCOOL KuaiLe", "Noto Sans SC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function signBoard(parent, text, w, h, x, y, z, rotY = 0) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map: makePixelText(text, { w: 512, h: 128, size: 48 }),
    transparent: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  parent.add(mesh);
  return mesh;
}

export function colliderFromSize(x, z, w, d, pad = 0.35) {
  return {
    minX: x - w / 2 - pad,
    maxX: x + w / 2 + pad,
    minZ: z - d / 2 - pad,
    maxZ: z + d / 2 + pad,
  };
}

export function pointInCollider(x, z, c) {
  return x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ;
}
