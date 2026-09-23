import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ArcticFox } from '../player/ArcticFox.js';
import { XiaoNa } from '../player/XiaoNa.js';
import { XiaoMing } from '../player/XiaoMing.js';
import { characterById } from '../player/characters.js';
import { CampusEnvironment,timePresets } from '../render/CampusEnvironment.js';
import { Input } from './Input.js';
import { Navigation } from './Navigation.js';
import { buildCampus } from '../world/CampusBuilder.js';
import { pointInCollider } from '../world/voxel.js';
import { stepPetals } from '../world/props.js';
import { bindHud,drawMap } from '../ui/hud.js';
import { fudanCampus } from '../data/fudanCampus.js';
import { validateCampus } from '../world/validateCampus.js';

const SAVE_KEY='fudan-garden-adventure-v2';
export class Game {
 constructor(canvas,campus=fudanCampus,localCampusKey=null){
  this.canvas=canvas;this.campus=campus;this.customCampus=campus!==fudanCampus;this.saveKey=this.customCampus?'3dschool-campus:'+campus.id+':v1':SAVE_KEY;this.input=new Input();this.clock=new THREE.Clock();this.playing=false;this.route=[];this.done=new Set();this.speechTimer=0;this.lastSpeechId='';this.completed=false;this.angle=.28;this.zoom=36;this.evening=false;this.timeOfDay='day';this.sound=false;this.mapTimer=0;this.saveTimer=0;
  if(localCampusKey)this.saveKey='3dschool-local-campus:'+localCampusKey+':v1';
  this.setupRenderer();this.setupScene();validateCampus(this.campus);this.world=buildCampus(this.campus);this.scene.add(this.world.root);this.environment=new CampusEnvironment(this.scene,this.world,this.hemi,this.sun,this.renderer);this.characters={fox:new ArcticFox(),nana:new XiaoNa(),ming:new XiaoMing()};this.environment.registerCharacters(this.characters);this.characterId='fox';this.fox=this.characters.fox;this.scene.add(this.fox.group);this.nav=new Navigation(this.campus,(x,z)=>this.blocked(x,z));this.hud=bindHud(this,this.campus);
  const gl=this.renderer.getContext();this.world.occlusion.msaaSamples.value=Math.max(1,gl.getParameter(gl.SAMPLES));
  const ring=new THREE.Mesh(new THREE.RingGeometry(.76,.84,40),new THREE.MeshBasicMaterial({color:0xffe4a3,transparent:true,opacity:.6,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.15;this.playerRing=ring;this.scene.add(ring);
  const el=document.createElement('div');el.className='player-marker';el.textContent='阿雪';this.playerLabel=new CSS2DObject(el);this.playerLabel.position.set(0,2.05,0);this.fox.group.add(this.playerLabel);
  this.destination=new THREE.Mesh(new THREE.RingGeometry(.4,.48,32),new THREE.MeshBasicMaterial({color:0xffedac,side:THREE.DoubleSide}));this.destination.rotation.x=-Math.PI/2;this.destination.visible=false;this.scene.add(this.destination);
  this.resetWorld();this.bindPointer();window.addEventListener('resize',()=>this.resize());window.addEventListener('beforeunload',()=>this.save());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.save();});
  this.cameraFocus.set(-8,0,-3);this.updateCamera(1,true);
 }
 setupRenderer(){
  this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  this.labelRenderer=new CSS2DRenderer({element:document.getElementById('label-layer')});this.labelRenderer.setSize(innerWidth,innerHeight);
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('error-message').hidden=false;this.save();});
  this.canvas.addEventListener('webglcontextrestored',()=>location.reload());
 }
 setupScene(){
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xbac8a6);this.scene.fog=new THREE.FogExp2(0xbac8a6,.006);
  this.camera=new THREE.OrthographicCamera(-40,40,30,-30,.1,230);this.cameraFocus=new THREE.Vector3(-8,0,-3);this.cameraSize=64;
  this.hemi=new THREE.HemisphereLight(0xe0ebef,0x576844,1.25);this.scene.add(this.hemi);
  this.sun=new THREE.DirectionalLight(0xffe8c1,2.5);this.sun.position.set(-25,45,18);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-64,right:64,top:64,bottom:-64,near:.5,far:140});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=3;this.scene.add(this.sun);this.scene.add(this.sun.target);
 }
 resetWorld(clear=false){
  this.world.occlusion.reset();
  this.fox.setPose(this.campus.spawn.x,this.campus.spawn.z,this.campus.spawn.yaw);this.done.clear();this.completed=false;this.lastSpeechId='';this.route=[];this.setRouteVisual();
  let save=null;if(!clear){try{save=JSON.parse(localStorage.getItem(this.saveKey));}catch{}}
  this.selectCharacter(clear?this.characterId:characterById(save?.characterId).id,false);
  this.setTimeOfDay(clear?this.timeOfDay:(Object.hasOwn(timePresets,save?.timeOfDay)?save.timeOfDay:'day'),{instant:true,persist:false,announce:false});
  const tasks=new Set(this.campus.tasks.map(t=>t.id));if(save&&Array.isArray(save.done))save.done.forEach(id=>{if(tasks.has(id)&&id!=='memories')this.done.add(id);});
  this.world.memories.forEach(m=>{m.taken=Array.isArray(save?.memories)&&save.memories.includes(m.id);m.mesh.visible=!m.taken;});
  if(this.world.memories.every(m=>m.taken))this.done.add('memories');
  this.world.landmarks.forEach(m=>{m.checked=this.done.has(m.taskId);m.label.element.classList.toggle('checked',m.checked);});
  if(save?.campusId===this.campus.id&&Number.isFinite(save?.position?.x)&&Number.isFinite(save?.position?.z)&&!this.blocked(save.position.x,save.position.z))this.fox.setPose(save.position.x,save.position.z,Math.PI);
  this.completed=this.done.size===this.campus.tasks.length;this.hud.hideSpeech();this.hud.update(this.done,this.world.memories);if(clear)this.save();
 }
 selectCharacter(id,persist=true){
  if(!Object.hasOwn(this.characters,id))return false;
  const previous=this.fox,next=this.characters[id],{x,z}=previous.group.position;
  if(previous!==next){this.scene.remove(previous.group);next.setPose(x,z,previous.yaw);this.fox=next;this.scene.add(next.group);}
  this.characterId=id;const character=characterById(id);
  this.playerLabel.position.set(0,character.labelHeight,0);this.playerLabel.element.textContent=character.name;next.group.add(this.playerLabel);
  this.world.occlusion.samples[2][1]=character.occlusionHeight;this.world.occlusion.scanElapsed=Infinity;
  this.input.reset();this.hud.character(character);if(persist)this.save();return true;
 }
 save(){try{localStorage.setItem(this.saveKey,JSON.stringify({campusId:this.campus.id,characterId:this.characterId,timeOfDay:this.timeOfDay,done:[...this.done],memories:this.world.memories.filter(m=>m.taken).map(m=>m.id),position:{x:this.fox.group.position.x,z:this.fox.group.position.z}}));}catch{/* Browsers with storage disabled still support this session. */}}
 resize(){this.renderer.setSize(innerWidth,innerHeight);this.labelRenderer.setSize(innerWidth,innerHeight);this.updateCamera(0,true);}
 blocked(x,z){const r=.58;if(Math.abs(x)>this.campus.bounds.width/2-1.5||Math.abs(z)>this.campus.bounds.depth/2-1.5)return true;return this.world.colliders.some(c=>pointInCollider(x,z,{minX:c.minX-r,maxX:c.maxX+r,minZ:c.minZ-r,maxZ:c.maxZ+r}));}
 tryMove(dx,dz){const p=this.fox.group.position;if(!this.blocked(p.x+dx,p.z+dz)){p.x+=dx;p.z+=dz;}else{if(!this.blocked(p.x+dx,p.z))p.x+=dx;if(!this.blocked(p.x,p.z+dz))p.z+=dz;}}
 bindPointer(){
  let down=null,lastX=0,dragged=false;
  this.canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;down={x:e.clientX,y:e.clientY};lastX=e.clientX;dragged=false;this.canvas.setPointerCapture(e.pointerId);});
  this.canvas.addEventListener('pointermove',e=>{if(!down)return;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)dragged=true;if(dragged)this.angle-=(e.clientX-lastX)*.005;lastX=e.clientX;});
  this.canvas.addEventListener('pointerup',e=>{if(!down)return;const click=!dragged;down=null;if(click){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1),this.camera);const point=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),point)){this.hud.start();this.navigate(point.x,point.z);}}});
  this.canvas.addEventListener('pointercancel',()=>{down=null;});
  this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=THREE.MathUtils.clamp(this.zoom+e.deltaY*.025,23,66);},{passive:false});
 }
 navigate(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>this.campus.bounds.width/2-1.5||Math.abs(z)>this.campus.bounds.depth/2-1.5){this.hud.toast('这边是校园边界，换一条小路吧。');return false;}
  const route=this.nav.find(this.fox.group.position,{x,z});if(!route.length){this.hud.toast('这里暂时走不到，试试附近的小路。');return false;}
  this.route=route;this.setRouteVisual();this.hud.hideSpeech();this.speechTimer=0;return true;
 }
 setRouteVisual(){
  if(this.routeLine){this.scene.remove(this.routeLine);this.routeLine.geometry.dispose();this.routeLine.material.dispose();this.routeLine=null;}
  if(!this.destination)return;this.destination.visible=this.route.length>0;if(!this.route.length)return;
  const pts=[this.fox.group.position,...this.route].map(p=>new THREE.Vector3(p.x,.17,p.z));this.routeLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0xffedac,dashSize:.35,gapSize:.24,transparent:true,opacity:.7}));this.routeLine.computeLineDistances();this.scene.add(this.routeLine);const last=this.route.at(-1);this.destination.position.set(last.x,.18,last.z);
 }
 interact(){
  const p=this.fox.group.position;let nearest=null,closest=null,best=Infinity,changed=false;
  for(const m of this.world.landmarks){const a=m.approach||m,d=Math.hypot(p.x-a.x,p.z-a.z);if(d<best){best=d;closest=m;}if(d<m.radius){nearest=m;if(m.taskId&&!m.checked){m.checked=true;this.done.add(m.taskId);m.label.element.classList.add('checked');this.chime(659);this.hud.toast('✦ 已打卡 · '+m.title);changed=true;}}}
  const district=this.campus.districts.find(d=>Math.abs(p.x-d.x)<d.w/2&&Math.abs(p.z-d.z)<d.d/2);
  this.hud.location(best<12?closest.title:'校园林荫道',district?.name||(!this.customCampus&&p.z>22&&p.z<34?'邯郸路':'校园林荫道'));
  if(nearest&&this.lastSpeechId!==nearest.id){this.lastSpeechId=nearest.id;this.hud.say(nearest.title,nearest.speech);this.speechTimer=8;}else if(!nearest&&this.speechTimer<=0)this.lastSpeechId='';
  for(const m of this.world.memories){if(!m.taken&&Math.hypot(p.x-m.x,p.z-m.z)<1.5){m.taken=true;m.mesh.visible=false;this.hud.say(m.title,m.text);this.hud.toast('✦ 校园记忆 +1');this.speechTimer=6;this.chime(880);changed=true;}}
  if(changed){if(this.world.memories.every(m=>m.taken))this.done.add('memories');this.hud.update(this.done,this.world.memories);this.save();if(this.done.size===this.campus.tasks.length&&!this.completed){this.completed=true;this.route=[];this.setRouteVisual();this.hud.showComplete();}}
 }
 chime(freq){if(!this.sound||!this.audio)return;const now=this.audio.currentTime,osc=this.audio.createOscillator(),gain=this.audio.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.06,now+.02);gain.gain.exponentialRampToValueAtTime(.001,now+1);osc.connect(gain).connect(this.audio.destination);osc.start();osc.stop(now+1);}
 async toggleSound(){
  try{if(!this.audio)this.audio=new (window.AudioContext||window.webkitAudioContext)();this.sound=!this.sound;if(this.sound){await this.audio.resume();let beat=0;const notes=[261.63,329.63,392,523.25,440,392,329.63,293.66];this.chime(notes[0]);this.musicTimer=setInterval(()=>{if(!document.hidden)this.chime(notes[beat++%notes.length]);},1800);}else{clearInterval(this.musicTimer);await this.audio.suspend();}const b=document.getElementById('sound-btn');b.classList.toggle('sound-on',this.sound);b.setAttribute('aria-pressed',String(this.sound));b.setAttribute('aria-label',this.sound?'关闭环境音乐':'开启环境音乐');this.hud.toast(this.sound?'♪ 校园漫步小调已开启':'环境音乐已关闭');}catch{this.sound=false;this.hud.toast('当前浏览器暂不支持声音播放。');}
 }
 setTimeOfDay(id,{instant=false,persist=true,announce=true}={}){
  if(!Object.hasOwn(timePresets,id))return false;
  this.timeOfDay=id;this.evening=id==='evening';this.environment.setTime(id,instant);
  const preset=timePresets[id],order=Object.keys(timePresets),next=timePresets[order[(order.indexOf(id)+1)%order.length]];
  document.getElementById('time-label').textContent=preset.label;document.getElementById('time-icon').textContent=preset.icon;
  document.getElementById('time-btn').title=preset.label+' · 点击切换到'+next.label.split(' · ')[0];document.body.dataset.time=id;
  if(announce)this.hud.toast(preset.message);if(persist)this.save();return true;
 }
 toggleTime(){const order=Object.keys(timePresets);this.setTimeOfDay(order[(order.indexOf(this.timeOfDay)+1)%order.length]);}

 takePhoto(){
  this.renderer.render(this.scene,this.camera);const photo=document.createElement('canvas');photo.width=this.canvas.width;photo.height=this.canvas.height;const ctx=photo.getContext('2d');ctx.drawImage(this.canvas,0,0);ctx.fillStyle='#fff8e5';ctx.font=`${Math.max(18,photo.width*.018)}px serif`;ctx.fillText(this.campus.name+'漫游记  /  A LITTLE ADVENTURE',photo.width*.035,photo.height*.945);photo.toBlob(blob=>{if(!blob){this.hud.toast('照片生成失败，请重试。');return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=this.campus.id+'-postcard-'+Date.now()+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);this.hud.toast('校园明信片已保存，带走这一刻。');},'image/png');
 }
 updateCamera(dt,instant=false){
  const mobile=innerWidth<700,p=this.fox?.group.position||new THREE.Vector3();const target=this.playing?new THREE.Vector3(p.x,0,p.z-3):new THREE.Vector3(this.campus.intro.x,0,this.campus.intro.z);
  const t=instant?1:1-Math.exp(-dt*3.5);this.cameraFocus.lerp(target,t);const size=this.playing?this.zoom:(mobile?62:this.campus.intro.size);this.cameraSize=THREE.MathUtils.lerp(this.cameraSize,size,t);const aspect=innerWidth/innerHeight;this.camera.left=-this.cameraSize*aspect/2;this.camera.right=this.cameraSize*aspect/2;this.camera.top=this.cameraSize/2;this.camera.bottom=-this.cameraSize/2;this.camera.updateProjectionMatrix();
  this.camera.position.copy(this.cameraFocus).add(new THREE.Vector3(Math.sin(this.angle)*48,49,Math.cos(this.angle)*48));this.camera.lookAt(this.cameraFocus);
  this.sun.position.copy(this.cameraFocus).add(this.environment.sunOffset);this.sun.target.position.copy(this.cameraFocus);
  const marks=this.world?.landmarks||[],compact=document.body.classList.contains('compact-hud');
  const closest=compact?marks.reduce((best,m)=>Math.hypot(p.x-m.x,p.z-m.z)<Math.hypot(p.x-(best?.x??Infinity),p.z-(best?.z??Infinity))?m:best,null):null;
  for(const m of marks)m.label.visible=compact?(this.playing&&m===closest&&Math.hypot(p.x-m.x,p.z-m.z)<18):(this.playing?Math.hypot(p.x-m.x,p.z-m.z)<30:(!mobile&&Math.hypot(this.cameraFocus.x-m.x,this.cameraFocus.z-m.z)<43));
 }
 updateDecor(dt){
  const t=this.clock.elapsedTime;this.world.decorations.petals.position.set(this.fox.group.position.x,0,this.fox.group.position.z);stepPetals(this.world.decorations.petals,dt);this.world.decorations.water.forEach(w=>w.material.uniforms.time.value=t);
  for(const s of this.world.decorations.swans){const h=s.userData.home;s.position.set(h.x+Math.sin(t*.2+h.x)*1.2,.25+Math.sin(t*2)*.035,h.z+Math.cos(t*.22+h.z)*.8);s.rotation.y=Math.sin(t*.2)*.8;}
  for(const m of this.world.memories){if(m.taken)continue;m.mesh.rotation.y+=dt*.8;m.mesh.position.y=1.3+Math.sin(t*2+m.x)*.18;}
  this.playerRing.position.set(this.fox.group.position.x,.15,this.fox.group.position.z);this.destination.scale.setScalar(1+Math.sin(t*4)*.12);
 }
 updatePlayer(dt){
  if(this.input.joystick.pointer!==null&&this.route.length){this.route=[];this.setRouteVisual();}
  let move=this.input.move;if((move.x||move.z)&&!this.playing)this.hud.start();if(this.playing){
   if(move.x||move.z){if(this.route.length){this.route=[];this.setRouteVisual();}const x=move.x*Math.cos(this.angle)+move.z*Math.sin(this.angle),z=-move.x*Math.sin(this.angle)+move.z*Math.cos(this.angle);move={...move,x,z};}
   else if(this.route.length){const next=this.route[0],p=this.fox.group.position,dx=next.x-p.x,dz=next.z-p.z,len=Math.hypot(dx,dz);if(len<.18){this.route.shift();if(!this.route.length)this.setRouteVisual();}else{const amount=Math.min(1,len/(this.fox.speed*(move.running?this.fox.runMul:1)*dt||1));move={x:dx/len*amount,z:dz/len*amount,running:move.running};}}
   const speed=this.fox.speed*(move.running?this.fox.runMul:1);this.tryMove(move.x*speed*dt,move.z*speed*dt);this.fox.update(dt,move,move.running);this.interact();this.speechTimer-=dt;if(this.speechTimer<=0)this.hud.hideSpeech();this.saveTimer+=dt;if(this.saveTimer>4){this.save();this.saveTimer=0;}
  }
 }
 tick(){
  const dt=Math.min(this.clock.getDelta(),.05),modal=!!document.querySelector('dialog[open]');
  if(!modal)this.updatePlayer(dt);
  this.updateDecor(dt);this.updateCamera(dt);this.environment.update(dt,this.cameraFocus,this.fox.group.position);this.world.occlusion.update(dt,this.camera,this.fox.group.position,this.playing);this.renderer.render(this.scene,this.camera);this.labelRenderer.render(this.scene,this.camera);this.mapTimer+=dt;if(this.mapTimer>.12){drawMap(document.getElementById('minimap'),this);if(document.getElementById('map-dialog').open)drawMap(document.getElementById('large-map'),this,true);this.mapTimer=0;}this.frame=requestAnimationFrame(()=>this.tick());
 }
 start(){this.tick();}
}


