import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTree } from './props.js';

export function randomSeed(seed=471) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t=Math.imul(seed ^ seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
export function terrainTexture() {
 const rng=randomSeed(42),c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
 ctx.fillStyle='#789359';ctx.fillRect(0,0,1024,1024);
 for(let i=0;i<42000;i++){const x=rng()*1024,y=rng()*1024;ctx.fillStyle=['#9cac6a25','#527c4a30','#c0c07b20','#54754a24'][i%4];ctx.fillRect(x,y,2+rng()*10,2+rng()*8);}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);return texture;
}
export function pathTexture(){
 const rng=randomSeed(6),c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#d1bd8b';ctx.fillRect(0,0,256,256);
 for(let i=0;i<2600;i++){ctx.fillStyle=i%2?'#fff5d518':'#8e89561e';ctx.fillRect(rng()*256,rng()*256,1+rng()*5,1+rng()*3);}
 for(let y=0;y<256;y+=32){for(let x=-32;x<256;x+=48){ctx.strokeStyle='#9d96622c';ctx.lineWidth=1;ctx.strokeRect(x+(y%64?24:0)+2,y+2,44,28);}}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
}
export function plantGarden(root,campus,palette,registerOccluder=()=>{}){
 const rng=randomSeed(97),width=campus.bounds.width+12,depth=campus.bounds.depth+12;
 const occupied=(x,z,pad=0)=>campus.regions.some(r=>['path','plaza','road','sports','water','building'].includes(r.type)&&Math.abs(x-r.x)<(r.w||12)/2+pad&&Math.abs(z-r.z)<(r.d||8)/2+pad);
 const treeSpots=[];
 // Tall, layered greenery frames the campus; the paths and entrance stay clear.
 for(let i=0;i<1900;i++){
   const x=(rng()-.5)*width,z=(rng()-.5)*depth;
   if(occupied(x,z,2.2))continue;
   if(Math.hypot(x-campus.spawn.x,z-campus.spawn.z)<11)continue;
   if(Math.abs(x)<width*.42&&Math.abs(z)<depth*.42&&rng()>.48)continue;
   const cherry=(x<-8&&z>0)||(x>29&&z<1)?rng()<.57:rng()<.13;
   const scale=1.2+rng()*1.3;
   const tree=makeTree(cherry?'cherry':'green',palette,scale);tree.position.set(x,0,z);tree.rotation.y=rng()*6.28;root.add(tree);registerOccluder(tree);treeSpots.push({x,z,cherry,scale});
 }
 // Regular avenue trees give the walk a readable rhythm.
 for(const r of campus.regions.filter(r=>r.type==='path'&&(r.label||r.id.includes('pavement')))){
   const horizontal=r.w>r.d,length=horizontal?r.w:r.d;
   for(let along=-length/2+4;along<length/2;along+=8)for(const side of [-1,1]){
     const x=r.x+(horizontal?along:side*(r.w/2+2.5)),z=r.z+(horizontal?side*(r.d/2+2.5):along);
     if(occupied(x,z,1.5)||Math.hypot(x-campus.spawn.x,z-campus.spawn.z)<9)continue;
     const cherry=along%24===4,tree=makeTree(cherry?'cherry':'green',palette,1.5);tree.position.set(x,0,z);root.add(tree);registerOccluder(tree);treeSpots.push({x,z,cherry,scale:1.5});
   }
 }
 const blades=new THREE.BufferGeometry();blades.setAttribute('position',new THREE.Float32BufferAttribute([-.11,0,0,.09,0,0,.035,.44,.025,0,0,-.1,0,0,.1,.045,.35,.025],3));blades.computeVertexNormals();
 const grass=new THREE.InstancedMesh(blades,new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}),36000);
 const dummy=new THREE.Object3D(),color=new THREE.Color();let count=0;
 for(let i=0;i<65000&&count<36000;i++){const x=(rng()-.5)*width,z=(rng()-.5)*depth;if(occupied(x,z,.6))continue;dummy.position.set(x,.05,z);dummy.rotation.y=rng()*6.28;dummy.scale.setScalar(.55+rng()*1.3);dummy.updateMatrix();grass.setMatrixAt(count,dummy.matrix);color.setHSL(.20+rng()*.07,.28+rng()*.14,.31+rng()*.17);grass.setColorAt(count++,color);}
 grass.count=count;grass.receiveShadow=true;root.add(grass);
 const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.11,0),new THREE.MeshLambertMaterial({color:0xffffff}),650);count=0;
 for(let i=0;i<5000&&count<650;i++){const x=(rng()-.5)*width,z=(rng()-.5)*depth;if(occupied(x,z,.6))continue;if(rng()>.4)continue;dummy.position.set(x,.25+rng()*.2,z);dummy.scale.setScalar(.6+rng());dummy.updateMatrix();flowers.setMatrixAt(count,dummy.matrix);color.set([0xffedb0,0xfff7e1,0xf3a9ad,0xe9c868][count%4]);flowers.setColorAt(count++,color);}flowers.count=count;root.add(flowers);
 // Pebbles, soft moss, and little stone clusters break the flat ground.
 const stones=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xa4ad8b,flatShading:true}),100);count=0;
 for(let i=0;i<300;i++){const x=(rng()-.5)*width,z=(rng()-.5)*depth;if(occupied(x,z,1))continue;dummy.position.set(x,.15,z);dummy.rotation.set(rng(),rng(),rng());dummy.scale.set(.2+rng()*.5,.15+rng()*.3,.2+rng()*.5);dummy.updateMatrix();stones.setMatrixAt(count++,dummy.matrix);if(count===100)break;}stones.count=count;stones.castShadow=true;stones.receiveShadow=true;root.add(stones);
 return treeSpots;
}
// Bake static architecture and foliage into material batches, retaining animated objects separately.
export function batchStatic(root,occlusion){
 root.updateMatrixWorld(true);const groups=new Map(),remove=[];
 root.traverse(o=>{
   if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;
   let owner=o;while(owner!==root&&owner.userData.occluderId===undefined)owner=owner.parent;
   const id=owner.userData.occluderId||0;
   const e=o.matrixWorld.elements,key=o.material.uuid+'-'+o.castShadow+'-'+Math.floor(e[12]/48)+':'+Math.floor(e[14]/48);
   let entry=groups.get(key);if(!entry){entry={mat:o.material,shadow:o.castShadow,geos:[],hasOccluders:false};groups.set(key,entry);}
   const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);
   g.setAttribute('campusOccluder',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(id),1));
   entry.hasOccluders ||= id>0;entry.geos.push(g);occlusion?.capture(id,g);remove.push(o);
 });
 occlusion?.prepare();
 for(const o of remove)o.removeFromParent();
 for(const {mat,shadow,geos,hasOccluders} of groups.values()){const geometry=mergeGeometries(geos);const mesh=new THREE.Mesh(geometry,hasOccluders&&occlusion?occlusion.materialFor(mat):mat);mesh.castShadow=shadow;mesh.receiveShadow=true;root.add(mesh);geos.forEach(g=>g.dispose());}
}
export function lakeSurface(region){
 const uniforms={time:{value:0},night:{value:0},color:{value:new THREE.Color(0x609f94)}};
 const mat=new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;uniform float night;uniform vec3 color;varying vec2 vUv;void main(){float wave=sin(vUv.x*100.+vUv.y*32.+time*.9)*sin(vUv.y*72.-time*.6);float streak=pow(max(0.,sin(vUv.y*150.+sin(vUv.x*22.+time)*2.+time)),18.)*.18;vec3 c=color+wave*.018+streak;float edge=smoothstep(.0,.15,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));c=mix(vec3(.46,.60,.39),c,edge);c=mix(c,c*vec3(.12,.22,.38),night);gl_FragColor=vec4(c,1.);}`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(region.w,region.d),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(region.x,.13,region.z);return mesh;
}
