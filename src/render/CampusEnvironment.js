import * as THREE from 'three';

export const timePresets = {
  day: { label: '午后 · 14:30', icon: '☀', message: '春日午后，阳光正好。', sky: 0xbac8a6, fog: .006, hemi: 0xe0ebef, ground: 0x576844, ambient: 1.25, sun: 0xffe8c1, sunlight: 2.5, offset: [-25,45,18], exposure: 1.05, lamps: 0, night: 0 },
  evening: { label: '黄昏 · 17:30', icon: '◒', message: '把脚步放慢，等一场校园的落日。', sky: 0xc9ad8c, fog: .006, hemi: 0xe0ebef, ground: 0x576844, ambient: .85, sun: 0xffc18b, sunlight: 2.2, offset: [-42,22,18], exposure: 1.05, lamps: .22, night: 0 },
  night: { label: '夜晚 · 21:00', icon: '☾', message: '晚灯亮起，沿着月光下的小路继续漫游。', sky: 0x101b35, fog: .009, hemi: 0x95acd6, ground: 0x24364d, ambient: .8, sun: 0xa5c8ff, sunlight: .7, offset: [-24,42,28], exposure: .95, lamps: 1, night: 1 },
};

function glowTexture() {
  const canvas = document.createElement('canvas');canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.2,'rgba(255,255,255,.65)');
  gradient.addColorStop(.55,'rgba(255,255,255,.18)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(canvas);
}

export class CampusEnvironment {
  constructor(scene, world, hemi, sun, renderer) {
    Object.assign(this,{scene,world,hemi,sun,renderer});
    this.sunOffset = new THREE.Vector3();
    this.emissiveMaterials = new Set();
    this.playerMaterials = new Map();
    world.root.traverse(object => {
      if(object.isMesh && !Array.isArray(object.material) && object.material.userData.nightEmission) this.emissiveMaterials.add(object.material);
    });
    this.root = new THREE.Group();this.root.name = 'campus-night-lights';scene.add(this.root);
    this.texture = glowTexture();
    const spots = world.decorations.lamps;
    this.poolMaterial = new THREE.MeshBasicMaterial({color:0xffcd7b,map:this.texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(8.6,8.6),this.poolMaterial,spots.length);
    const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    spots.forEach((p,i)=>{matrix.compose(new THREE.Vector3(p.x,.24,p.z),rotation,new THREE.Vector3(1,1,1));this.pools.setMatrixAt(i,matrix);});
    this.pools.computeBoundingSphere();this.root.add(this.pools);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(spots.flatMap(p=>[p.x,2.2,p.z]),3));
    this.haloMaterial = new THREE.PointsMaterial({color:0xffd38b,map:this.texture,size:19,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    this.halos = new THREE.Points(geometry,this.haloMaterial);this.root.add(this.halos);
    // A fixed pool of nearby lights avoids a shader light for every campus lamp.
    this.localLights = Array.from({length:4},()=>{const light=new THREE.PointLight(0xffd49a,0,8,2);scene.add(light);return light;});
    this.lampCandidates = spots.map(p=>({...p,distance:0}));
    this.setTime('day',true);
  }

  registerCharacters(characters) {
    // Isolate avatar materials from voxelMat's cache before adding a subtle
    // night fill, so black clothing stays readable even behind a faded wall.
    for(const actor of Object.values(characters))actor.group.traverse(object=>{
      if(!object.isMesh || Array.isArray(object.material) || !object.material.emissive)return;
      const original=object.material;
      if(!this.playerMaterials.has(original))this.playerMaterials.set(original,original.clone());
      object.material=this.playerMaterials.get(original);
    });
  }

  setTime(id,instant=false) {
    this.mode = id;this.target = timePresets[id];
    this.colors = {sky:new THREE.Color(this.target.sky),hemi:new THREE.Color(this.target.hemi),ground:new THREE.Color(this.target.ground),sun:new THREE.Color(this.target.sun)};
    this.targetOffset = new THREE.Vector3(...this.target.offset);
    if(instant){this.night=this.target.night;this.lamps=this.target.lamps;this.apply(1);}
  }

  apply(blend) {
    const t=this.target;
    this.scene.background.lerp(this.colors.sky,blend);this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.density=THREE.MathUtils.lerp(this.scene.fog.density,t.fog,blend);
    this.hemi.color.lerp(this.colors.hemi,blend);this.hemi.groundColor.lerp(this.colors.ground,blend);
    this.hemi.intensity=THREE.MathUtils.lerp(this.hemi.intensity,t.ambient,blend);
    this.sun.color.lerp(this.colors.sun,blend);this.sun.intensity=THREE.MathUtils.lerp(this.sun.intensity,t.sunlight,blend);
    this.sunOffset.lerp(this.targetOffset,blend);
    this.renderer.toneMappingExposure=THREE.MathUtils.lerp(this.renderer.toneMappingExposure,t.exposure,blend);
    this.night=THREE.MathUtils.lerp(this.night,t.night,blend);this.lamps=THREE.MathUtils.lerp(this.lamps,t.lamps,blend);
    if(Math.abs(this.night-t.night)<.001)this.night=t.night;
    if(Math.abs(this.lamps-t.lamps)<.001)this.lamps=t.lamps;
    this.root.visible=this.lamps>.001;
    this.poolMaterial.opacity=this.lamps*.34;this.haloMaterial.opacity=this.lamps*.75;
    for(const material of this.emissiveMaterials){
      const kind=material.userData.nightEmission;
      material.emissive.set(kind==='glass'?0x6e9bd5:0xffc879);
      material.emissiveIntensity=this.lamps*(kind==='lamp'?2.5:kind==='glass'?.13:.9);
    }
    for(const material of this.playerMaterials.values()){
      material.emissive.set(0x7998c1);material.emissiveIntensity=this.night*.075;
    }
    this.world.decorations.water.forEach(w=>{w.material.uniforms.night.value=this.night;});
  }

  update(dt,focus,player) {
    this.apply(1-Math.exp(-Math.min(dt,.1)*4));
    this.sun.position.copy(focus).add(this.sunOffset);this.sun.target.position.copy(focus);
    if(this.lamps<=.001){this.localLights.forEach(light=>{light.intensity=0;});return;}
    for(const p of this.lampCandidates)p.distance=(p.x-player.x)**2+(p.z-player.z)**2;
    this.lampCandidates.sort((a,b)=>a.distance-b.distance);
    this.localLights.forEach((light,i)=>{
      const p=this.lampCandidates[i];
      if(!p){light.intensity=0;return;}
      light.position.set(p.x,2.05,p.z);
      light.intensity=14*this.lamps*(1-THREE.MathUtils.smoothstep(Math.sqrt(p.distance),8,18));
    });
  }
}
