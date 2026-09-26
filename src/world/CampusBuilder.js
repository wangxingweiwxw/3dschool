import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { palettes } from './palette.js';
import { box,voxelMat,colliderFromSize,colliderFromLocalBox } from './voxel.js';
import { recipes } from './buildings.js';
import { buildSportsField } from './expandedBuildings.js';
import { makeLamp,makeBench,makeSwan,makePetalSystem } from './props.js';
import { terrainTexture,pathTexture,plantGarden,batchStatic,lakeSurface } from './garden.js';
import { OcclusionFader } from '../render/OcclusionFader.js';

export function buildCampus(campus){
 const c={...palettes['fudan-spring'],grass:0x81935c,leaf:0x678754,brick:0xad7259,brickDark:0x82503f,cream:0xeee4c9,creamDark:0xcfc7ab,roof:0x62736b,glass:0x719a9b,glassDeep:0x456c74,shop:0x567e8e,...campus.palette};
 const root=new THREE.Group(),staticRoot=new THREE.Group();root.add(staticRoot);
 const occlusion=new OcclusionFader();
 const colliders=[],landmarks=[],decorations={swans:[],petals:null,water:[],lamps:[]};
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(320,320),new THREE.MeshLambertMaterial({map:terrainTexture()}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;staticRoot.add(ground);
 const pathTex=pathTexture();
 let groundLayer=0;
 for(const r of campus.regions){
   if(r.type==='road'){
     box(staticRoot,r.w,.10,r.d,0x777d75,r.x,.015,r.z,{noShadow:true});
     for(let x=r.x-r.w/2+2;x<r.x+r.w/2-1;x+=5)box(staticRoot,2.5,.015,.10,0xe5d498,x,.075,r.z,{noShadow:true});
   }else if(r.type==='sports'){
     const built=buildSportsField(r,c);staticRoot.add(built.group);colliders.push(built.collider);occlusion.register(built.group,{id:r.id});
   }else if(r.type==='path'||r.type==='plaza'){
     const tex=pathTex.clone();tex.repeat.set(r.w/4,r.d/4);
     const mesh=new THREE.Mesh(new THREE.BoxGeometry(r.w,.12,r.d),new THREE.MeshLambertMaterial({map:tex,color:r.type==='plaza'?0xf9f0d7:0xffffff}));mesh.position.set(r.x,.02+(groundLayer++)*.0008,r.z);mesh.receiveShadow=true;staticRoot.add(mesh);
     if(r.type==='path'){
       box(staticRoot,.17,.16,r.d,0xb9bb92,r.x-r.w/2,.06,r.z,{noShadow:true});box(staticRoot,.17,.16,r.d,0xb9bb92,r.x+r.w/2,.06,r.z,{noShadow:true});
     }
   }else if(r.type==='building'){
     const built=recipes[r.recipe](r,c);staticRoot.add(built.group);colliders.push(...(built.colliders||(built.collider?[built.collider]:[])));occlusion.register(built.group,{id:r.id});
   }else if(r.type==='water'){
     const water=lakeSurface(r);root.add(water);decorations.water.push(water);colliders.push(colliderFromSize(r.x,r.z,r.w,r.d,.1));
     // Timber deck on the east bank: accessible from the path without walking on water.
     for(let i=0;i<15;i++)box(staticRoot,2.5,.15,.38,0x99805c,r.x+r.w/2+1.3,.17,r.z-3+i*.42);
     for(const z of [r.z-3,r.z+3]){box(staticRoot,.14,1,.14,0x716649,r.x+r.w/2+.1,.6,z);box(staticRoot,2.6,.11,.11,0x877955,r.x+r.w/2+1.3,1,z);}
     for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const stone=new THREE.Mesh(new THREE.IcosahedronGeometry(.5,0),voxelMat(0x9ba488));stone.position.set(r.x+Math.cos(a)*(r.w/2+.1),.12,r.z+Math.sin(a)*(r.d/2+.1));stone.scale.set(1.2,.6,1);stone.castShadow=true;staticRoot.add(stone);}
   }else if(r.type==='prop-row'){
     for(let i=0;i<r.count;i++){const p=r.kind==='bench'?makeBench(c):makeLamp(c),t=r.count===1?0:i/(r.count-1)-.5;p.position.set(r.x+(r.dx||0)*t,0,r.z+(r.dz||0)*t);staticRoot.add(p);if(r.kind!=='bench')decorations.lamps.push({x:p.position.x,z:p.position.z});}
   }
 }
 let treeIndex=0;
 const treeSpots=plantGarden(staticRoot,campus,c,tree=>occlusion.register(tree,{id:`tree-${treeIndex++}`,kind:'foliage'}));
 for(const crossing of campus.crossings||[]){
   for(let dz=-4.3;dz<4.5;dz+=1.2)box(staticRoot,4.5,.025,.55,0xf3eed5,crossing.x,.086,crossing.z+dz,{noShadow:true});
 }
 // Entry walls follow the gate when the campus layout changes.
 const gate=campus.regions.find(r=>r.id===(campus.entryGateId||'handan-gate'));
 if(gate)for(const s of [-1,1]){
   const x=s*11;
   const wall=new THREE.Group();wall.position.set(gate.x,0,gate.z);wall.rotation.y=gate.rotation||0;staticRoot.add(wall);
   box(wall,9,1.1,.7,0xbaae91,x,.55,0);box(wall,9.3,.17,.9,c.cream,x,1.15,0);
   occlusion.register(wall,{id:`gate-wall-${s}`});
   colliders.push(colliderFromLocalBox(gate,x,0,9,.7,0));
 }
 batchStatic(staticRoot,occlusion);
 for(const b of campus.swans){const swan=makeSwan(c);swan.position.set(b.x,.15,b.z);swan.userData.home=b;root.add(swan);decorations.swans.push(swan);}
 for(const m of campus.landmarks){const el=document.createElement('div');el.className='label-bubble';const title=document.createElement('b'),quote=document.createElement('span');title.textContent=m.title;quote.textContent=m.quote;el.append(title,quote);const label=new CSS2DObject(el);label.position.set(m.x,m.labelY,m.z);root.add(label);landmarks.push({...m,label,checked:false});}
 decorations.petals=makePetalSystem(240);root.add(decorations.petals);
 const memories=campus.memories.map(m=>{const mesh=new THREE.Group();const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.38),new THREE.MeshStandardMaterial({color:0xffda81,emissive:0xffc050,emissiveIntensity:.5,roughness:.3}));gem.scale.set(.8,1.3,.8);mesh.add(gem);const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.022,5,32),new THREE.MeshBasicMaterial({color:0xffe3a2}));ring.rotation.x=Math.PI/2;mesh.add(ring);mesh.position.set(m.x,1,m.z);root.add(mesh);return {...m,mesh,taken:false};});
 return {root,colliders,landmarks,memories,decorations,treeSpots,palette:c,occlusion};
}
