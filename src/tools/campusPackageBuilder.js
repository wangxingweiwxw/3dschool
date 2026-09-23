import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateCampusPackage } from '../data/campusPackage.js';
import { buildCampus } from '../world/CampusBuilder.js';
import { Navigation } from '../game/Navigation.js';
import { pointInCollider } from '../world/voxel.js';

// Used by the skill's local browser runner, never loaded by the game entrypoint.
export async function buildCampusPackage(payload) {
  const campus=validateCampusPackage(payload),world=buildCampus(campus);
  const blocked=(x,z)=>Math.abs(x)>campus.bounds.width/2-1.5||Math.abs(z)>campus.bounds.depth/2-1.5||world.colliders.some(c=>pointInCollider(x,z,{minX:c.minX-.58,maxX:c.maxX+.58,minZ:c.minZ-.58,maxZ:c.maxZ+.58}));
  if(blocked(campus.spawn.x,campus.spawn.z))throw new Error('出生点落在碰撞体内');
  const nav=new Navigation(campus,blocked),routes=[];
  for(const target of [...campus.landmarks.map(m=>({id:m.id,...m.approach})),...campus.memories]){
    if(blocked(target.x,target.z))throw new Error(`目的地 ${target.id} 落在碰撞体内`);
    const path=nav.find(campus.spawn,target);let previous=campus.spawn;
    if(!path.length||Math.hypot(path.at(-1).x-target.x,path.at(-1).z-target.z)>.15)throw new Error(`目的地 ${target.id} 不可达`);
    for(const p of path){if(!nav.clear(previous,p))throw new Error(`路径穿模：${target.id}`);previous=p;}
    routes.push({id:target.id,reachable:true,steps:path.length});
  }
  // Export the completed campus geometry, with static swans and water. Gameplay
  // labels, collectible markers, particles and shader behavior live in the JSON.
  world.root.remove(world.decorations.petals,...world.landmarks.map(m=>m.label),...world.memories.map(m=>m.mesh));
  const materials=new Map();
  world.root.traverse(object=>{
    if(!object.isMesh)return;
    const source=object.material;
    if(!materials.has(source)){
      const material=new THREE.MeshStandardMaterial({color:source.isShaderMaterial?0x609f94:source.color,map:source.map||null,roughness:.95,metalness:0,side:source.side});
      material.userData={...source.userData};materials.set(source,material);
    }
    object.material=materials.get(source);
    // Occlusion IDs are a runtime implementation detail, not a glTF attribute.
    object.geometry=object.geometry.clone();object.geometry.deleteAttribute('campusOccluder');
  });
  world.root.updateMatrixWorld(true);
  const binary=await new GLTFExporter().parseAsync(world.root,{binary:true,maxTextureSize:1024});
  const loaded=await new GLTFLoader().parseAsync(binary,'');
  let meshes=0,instances=0;loaded.scene.traverse(o=>{if(o.isMesh)meshes++;if(o.isInstancedMesh)instances+=o.count;});
  if(!meshes)throw new Error('导出的 GLB 不含模型');
  const bounds=new THREE.Box3().setFromObject(loaded.scene);
  if(![...bounds.min,...bounds.max].every(Number.isFinite))throw new Error('GLB 存在无效几何');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xbac8a6);scene.add(loaded.scene);
  scene.add(new THREE.HemisphereLight(0xe0ebef,0x576844,1.25));
  const sun=new THREE.DirectionalLight(0xffe8c1,2.5);sun.position.set(-60,100,70);scene.add(sun);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,960);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const size=Math.max(campus.bounds.width*.86,campus.bounds.depth*.86),camera=new THREE.OrthographicCamera(-size*4/6,size*4/6,size/2,-size/2,.1,650);
  camera.position.set(38,180,168);camera.lookAt(0,0,0);renderer.render(scene,camera);
  const preview=renderer.domElement.toDataURL('image/png');renderer.dispose();
  const report={format:payload.format,version:1,id:campus.id,buildings:campus.regions.filter(r=>r.type==='building').length,trees:world.treeSpots.length,colliders:world.colliders,spawnClear:true,routes,glb:{bytes:binary.byteLength,meshes,instances,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},roundTripLoaded:true},warnings:['GLB 是静态模型快照；碰撞、夜景、透视、任务由配套 campus.json 在 3Dschool 中重建。','平面地图无法确定建筑高度和立面；外观为艺术化建模。']};
  return {binary,preview,report};
}
