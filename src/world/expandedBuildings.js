import * as THREE from 'three';
import {box,cylinder,signBoard,colliderFromSize,voxelMat} from './voxel.js';

function windows(g,w,d,h,c,floors){
 const columns=Math.max(3,Math.floor(w/2.3));
 for(let floor=0;floor<floors;floor++){
  const y=1.5+floor*(h-1.7)/floors;
  for(let col=0;col<columns;col++){
   const x=(col-(columns-1)/2)*((w-2)/columns);
   for(const side of [-1,1]){
    box(g,1.1,.95,.09,c.glassDeep,x,y,side*(d/2+.05),{noShadow:true,nightEmission:'window'});
    box(g,1.22,.09,.16,c.cream,x,y-.51,side*(d/2+.09),{noShadow:true});
   }
  }
  for(const x of [-w/2-.05,w/2+.05])for(let z=-d/2+2;z<d/2-1;z+=2.2)box(g,.09,.95,.85,c.glassDeep,x,y,z,{noShadow:true,nightEmission:'window'});
 }
}
export function buildTeachingBlock(r,c){
 const g=new THREE.Group();g.position.set(r.x,0,r.z);const {w,d,h}=r;
 box(g,w,h,d,r.tint||0xdfd7bd,0,h/2,0);box(g,w+.4,.24,d+.4,c.roof,0,h+.08,0);
 box(g,w+.35,.28,d+.35,c.creamDark,0,.14,0);
 windows(g,w,d,h,c,r.floors||3);
 box(g,3.2,2.3,.16,0x47676a,0,1.2,d/2+.1);
 box(g,4.6,.18,1.8,c.cream,0,2.65,d/2+.55);
 if(r.showSign!==false)signBoard(g,r.label,Math.min(w*.7,r.label.length*.95),.85,0,h-.75,d/2+.14);
 return{group:g,collider:colliderFromSize(r.x,r.z,w,d)};
}
export function buildLibrary(r,c){
 const g=new THREE.Group();g.position.set(r.x,0,r.z);const {w,d,h}=r;
 box(g,w,h,d,0xd9ceb4,0,h/2,0);box(g,w+.6,.3,d+.6,c.roof,0,h+.1,0);
 windows(g,w,d,h,c,3);
 box(g,w*.5,h+.65,d*.58,0xece4cf,0,(h+.65)/2,1);
 box(g,w*.5+.5,.26,d*.58+.4,c.creamDark,0,h+.7,1);
 box(g,w*.32,3,.15,0x546c68,0,1.65,d/2+.13);
 for(let i=-2;i<=2;i++)cylinder(g,.2,.23,3.8,c.cream,i*w*.095,2,d/2+.7,8);
 box(g,w*.62,.24,2.5,c.cream,0,4.05,d/2+.4);
 signBoard(g,r.label,w*.4,.72,0,5.1,d/2+.18);
 for(let i=0;i<3;i++)box(g,w*.65+i*.7,.15,1.0,c.plaza,0,.42-i*.13,d/2+1.4+i*.7);
 return{group:g,collider:colliderFromSize(r.x,r.z,w,d)};
}
export function buildBusinessSchool(r,c){
 const built=buildTeachingBlock({...r,tint:r.tint||0xaf7d64,floors:4,showSign:false},c),g=built.group,{w,d,h}=r;
 box(g,5,h+1,d+.2,c.creamDark,0,(h+1)/2,0);
 for(let y=2;y<h;y+=1.8)box(g,3.5,1.15,.12,c.glass,0,y,d/2+.18,{noShadow:true,nightEmission:'window'});
 box(g,6.2,.4,d+1,c.cream,0,h+.9,0);
 signBoard(g,r.label,4,.75,0,h-.1,d/2+.2);
 box(g,7,.2,2.2,c.cream,0,3,d/2+.5);
 if(r.front===-1)g.rotation.y=Math.PI;
 return built;
}
function oval(w,d){const s=new THREE.Shape();s.absellipse(0,0,w/2,d/2,0,Math.PI*2,false);return s;}
export function buildSportsField(r,c){
 const g=new THREE.Group();g.position.set(r.x,0,r.z);
 const surface=(w,d,color,y)=>{const geo=new THREE.ShapeGeometry(oval(w,d),64);geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,voxelMat(color));m.position.y=y;m.receiveShadow=true;g.add(m);};
 surface(r.w,r.d,0xac6b59,.12);
 for(let lane=1;lane<=4;lane++){
  const shape=oval(r.w-lane*1.1,r.d-lane*1.1);shape.holes.push(oval(r.w-lane*1.1-.08,r.d-lane*1.1-.08));
  const geo=new THREE.ShapeGeometry(shape,64);geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,voxelMat(0xe2cbaa));m.position.y=.14;g.add(m);
 }
 surface(r.w-8,r.d-8,0x7b9c62,.15);
 const fw=r.w*.52,fd=r.d*.61;
 for(const x of [-fw/2,fw/2])box(g,.09,.025,fd,0xe1e6c8,x,.18,0,{noShadow:true});
 for(const z of [-fd/2,0,fd/2])box(g,fw,.025,.09,0xe1e6c8,0,.18,z,{noShadow:true});
 const circle=new THREE.Mesh(new THREE.RingGeometry(3.8,3.9,40),voxelMat(0xe1e6c8));circle.rotation.x=-Math.PI/2;circle.position.y=.19;g.add(circle);
 for(const z of [-fd/2,fd/2]){for(const x of [-2,2])box(g,.12,1.8,.12,c.white,x,.95,z);box(g,4.1,.12,.12,c.white,0,1.85,z);}
 // Open access all around; only the small bleachers occupy space.
 for(let i=0;i<3;i++)box(g,11,.4,1.2,0xc9c4ad,0,.2+i*.35,r.d/2+1+i);
 return {group:g,collider:colliderFromSize(r.x,r.z+r.d/2+2,11,3)};
}
export const expandedRecipes={'teaching-block':buildTeachingBlock,library:buildLibrary,'business-school':buildBusinessSchool};
