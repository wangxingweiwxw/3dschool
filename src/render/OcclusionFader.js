import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Screen-aligned coverage is identical across every overlapping surface. MSAA
// softens the coverage; devices without it retain the pixel-style stipple. Unlike
// ordinary alpha blending, stacked walls/roofs cannot accumulate into an opaque
// layer over the fox, and transparent triangle sorting is unnecessary.
const coverageShader = /* glsl */`
float campusBayer2(vec2 p) {
  vec2 q = mod(floor(p), 2.0);
  return 2.0 * q.x + 3.0 * q.y - 4.0 * q.x * q.y;
}
float campusCoverageThreshold(vec2 p) {
  return (4.0 * campusBayer2(p) + campusBayer2(floor(p / 2.0)) + 0.5) / 16.0;
}
`;

export class OcclusionFader {
  constructor() {
    this.enabled = true;
    this.entries = [];
    this.materials = new Map();
    this.time = 0;
    this.scanElapsed = Infinity;
    this.raycaster = new THREE.Raycaster();
    this.proxyMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.point = new THREE.Vector3();
    this.projected = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.intersection = new THREE.Vector3();
    this.hits = [];
    this.samples = [
      [0, 0.22], [0, 1.05], [0, 2.1],
      [-0.65, 0.45], [0.65, 0.45], [-0.65, 1.6], [0.65, 1.6],
    ];
    this.lastHits = [];
    this.msaaSamples = { value: 1 };
  }

  register(group, { id, kind = 'building' }) {
    const index = this.entries.length + 1; // Slot zero always stays fully opaque.
    group.userData.occluderId = index;
    this.entries.push({ index, id, kind, geometry: [], opacity: 1, lastHit: -Infinity, proxy: null });
  }

  capture(index, geometry) {
    if (index > 0) this.entries[index - 1].geometry.push(geometry);
  }

  prepare() {
    this.textureWidth = THREE.MathUtils.ceilPowerOfTwo(this.entries.length + 1);
    this.values = new Float32Array(this.textureWidth).fill(1);
    this.texture = new THREE.DataTexture(this.values, this.textureWidth, 1, THREE.RedFormat, THREE.FloatType);
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    for (const entry of this.entries) {
      if (!entry.geometry.length) continue;
      // Positions are already in world space. These meshes only serve raycasts;
      // they are never added to the scene or submitted to the GPU.
      const geometry = mergeGeometries(entry.geometry);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      entry.proxy = new THREE.Mesh(geometry, this.proxyMaterial);
      entry.proxy.updateMatrixWorld(true);
      entry.geometry = [];
    }
  }

  materialFor(original) {
    if (this.materials.has(original)) return this.materials.get(original);
    // Do not modify voxelMat's shared material: the fox uses that cache too.
    const material = original.clone();
    // Keep opaque depth sorting and full shadows; MSAA resolves covered samples
    // into a translucent silhouette without blending every wall over the fox.
    material.alphaToCoverage = true;
    material.onBeforeCompile = shader => {
      shader.uniforms.campusFadeMap = { value: this.texture };
      shader.uniforms.campusFadeWidth = { value: this.textureWidth };
      shader.uniforms.campusMsaaSamples = this.msaaSamples;
      shader.vertexShader = `
        attribute float campusOccluder;
        uniform sampler2D campusFadeMap;
        uniform float campusFadeWidth;
        varying float vCampusCoverage;
      ` + shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vCampusCoverage = texture2D(campusFadeMap, vec2((campusOccluder + 0.5) / campusFadeWidth, 0.5)).r;
      `);
      shader.fragmentShader = `varying float vCampusCoverage;\nuniform float campusMsaaSamples;\n${coverageShader}\n` + shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        if (vCampusCoverage < 0.999) {
          float threshold = campusCoverageThreshold(gl_FragCoord.xy);
          if (campusMsaaSamples > 1.0) {
            float coverage = vCampusCoverage * campusMsaaSamples;
            float samples = floor(coverage) + step(threshold, fract(coverage));
            gl_FragColor.a = samples / campusMsaaSamples;
          } else if (vCampusCoverage < threshold) discard;
        }`,
      );
    };
    material.customProgramCacheKey = () => 'campus-occlusion-coverage-v2';
    this.materials.set(original, material);
    return material;
  }

  scan(camera, playerPosition) {
    this.lastHits = [];
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    for (const [side, height] of this.samples) {
      this.point.copy(playerPosition).addScaledVector(this.right, side);
      this.point.y += height;
      this.projected.copy(this.point).project(camera);
      // setFromCamera is essential for the orthographic camera: all rays are
      // parallel, rather than aimed outwards from a single camera position.
      this.raycaster.setFromCamera(this.projected, camera);
      this.raycaster.near = 0;
      this.raycaster.far = Math.max(0, this.raycaster.ray.origin.distanceTo(this.point) - 0.08);
      for (const entry of this.entries) {
        if (!entry.proxy || entry.lastHit === this.time) continue;
        const hit = this.raycaster.ray.intersectBox(entry.proxy.geometry.boundingBox, this.intersection);
        if (!hit || hit.distanceTo(this.raycaster.ray.origin) > this.raycaster.far) continue;
        this.hits.length = 0;
        this.raycaster.intersectObject(entry.proxy, false, this.hits);
        if (this.hits.length) {
          entry.lastHit = this.time;
          this.lastHits.push(entry.id);
        }
      }
    }
  }

  update(dt, camera, playerPosition, playing = true) {
    if (!this.texture) return;
    const step = Math.min(Math.max(dt, 0), 0.1);
    this.time += step;
    this.scanElapsed += step;
    const active = this.enabled && playing;
    if (active && this.scanElapsed >= 1 / 30) {
      // The render hasn't run yet, so explicitly refresh the camera matrices.
      camera.updateMatrixWorld(true);
      this.scan(camera, playerPosition);
      this.scanElapsed = 0;
    } else if (!active) {
      this.lastHits = [];
    }
    let changed = false;
    for (const entry of this.entries) {
      // Briefly retain a hit at edges so walking and camera rotation don't flicker.
      const obscures = active && this.time - entry.lastHit < 0.18;
      const target = obscures ? (entry.kind === 'foliage' ? 0.12 : 0.18) : 1;
      const rate = target < entry.opacity ? 18 : 7;
      let opacity = THREE.MathUtils.lerp(entry.opacity, target, 1 - Math.exp(-rate * step));
      if (Math.abs(opacity - target) < 0.001) opacity = target;
      if (opacity !== entry.opacity) {
        entry.opacity = opacity;
        this.values[entry.index] = opacity;
        changed = true;
      }
    }
    if (changed) this.texture.needsUpdate = true;
  }

  reset() {
    this.time = 0;
    this.scanElapsed = Infinity;
    this.lastHits = [];
    for (const entry of this.entries) { entry.opacity = 1; entry.lastHit = -Infinity; }
    if (this.values) { this.values.fill(1); this.texture.needsUpdate = true; }
  }

  getDebugState() {
    return { enabled: this.enabled, hits: [...this.lastHits], faded: this.entries.filter(e => e.opacity < 0.999).map(e => ({ id: e.id, kind: e.kind, opacity: e.opacity })) };
  }

  dispose() {
    this.texture?.dispose();
    this.proxyMaterial.dispose();
    this.entries.forEach(e => e.proxy?.geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
  }
}
