import {regionFootprint} from '../world/voxel.js';
import { applyCampusIdentity,escapeHtml } from './campusIdentity.js';
import { characters } from '../player/characters.js';
import { bindMobileHud } from './mobileHud.js';
const $=id=>document.getElementById(id);
export function bindHud(game,campus){
 if(game.customCampus)applyCampusIdentity(campus);
 let timer,signature='',filter='all';
 const open=id=>{game.input.reset();if(!$(id).open)$(id).showModal();};
 const start=()=>{game.playing=true;document.body.classList.add('playing');$('welcome').inert=true;};
 const openMap=()=>{drawMap($('large-map'),game,true);open('map-dialog');};
 const mobile=bindMobileHud(game,openMap);
 const choices=characters.map(c=>`<button class="character-card" data-character="${c.id}" aria-label="选择${c.name}" aria-pressed="false"><span class="character-check" aria-hidden="true">✓</span><img src="./${c.portrait}" alt="" width="144" height="132"><span class="character-info"><strong>${c.name}</strong><small>${c.title}</small></span><span class="character-description">${c.description}</span></button>`).join('');
 for(const id of ['welcome-characters','dialog-characters']){$(id).innerHTML=choices;$(id).onclick=e=>{const button=e.target.closest('[data-character]');if(button)game.selectCharacter(button.dataset.character);};}
 $('character-btn').onclick=()=>open('character-dialog');
 const options='<option value="all">全校探索</option>'+campus.districts.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
 $('quest-zone').innerHTML=options;$('map-zone').innerHTML=options;
 $('memory-total').textContent='/ '+campus.memories.length;
 $('complete-summary').textContent=`${campus.landmarks.filter(m=>m.taskId).length} 处地标，${campus.memories.length} 枚记忆。把校园里的故事，一起装进回忆。`;
 const renderTasks=()=>{
  const done=game.done,mem=game.world.memories.filter(m=>m.taken).length;
  $('task-list').innerHTML=campus.tasks.filter(t=>filter==='all'||t.zone===filter||t.id==='memories').map(t=>`<li class="${done.has(t.id)?'done':''}"><button data-task="${t.id}" title="步行前往${escapeHtml(t.label)}"><span class="mark">${done.has(t.id)?'✓':escapeHtml(t.icon)}</span><span class="task-name">${escapeHtml(t.label)}</span><span class="task-arrow">${t.id==='memories'?mem+'/'+campus.memories.length:'↗'}</span></button></li>`).join('');
 };
 const renderDestinations=()=>{$('map-destinations').innerHTML=campus.landmarks.filter(m=>game.mapZone==='all'||m.zone===game.mapZone).map(m=>`<button data-destination="${m.id}">${game.done.has(m.taskId)?'✓':'⌖'} ${escapeHtml(m.title)}</button>`).join('');};
 game.mapZone='all';renderDestinations();
 $('quest-zone').onchange=e=>{filter=e.target.value;renderTasks();};
 $('map-zone').onchange=e=>{game.mapZone=e.target.value;renderDestinations();drawMap($('large-map'),game,true);};
 $('start-btn').onclick=()=>{start();game.hud.toast(mobile.compact()?'拖动左下角摇杆移动，松手停止。':'按 M 看全图，选择片区开始探索。');};
 $('map-btn').onclick=$('minimap-open').onclick=openMap;
 $('help-btn').onclick=()=>open('help-dialog');
 game.input.onMap=()=>{if($('map-dialog').open)$('map-dialog').close();else if(!document.querySelector('dialog[open]')){drawMap($('large-map'),game,true);open('map-dialog');}};
 document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
 $('speech-close').onclick=()=>{$('speech').hidden=true;game.speechTimer=0;};
 $('time-btn').onclick=()=>game.toggleTime();$('photo-btn').onclick=()=>game.takePhoto();$('sound-btn').onclick=()=>game.toggleSound();
 $('reset-btn').onclick=()=>{game.resetWorld(true);$('help-dialog').close();start();game.hud.toast('背包清空了，开始一段新的校园漫游。');};
 const go=id=>{const mark=campus.landmarks.find(m=>m.id===id);let dest=mark?.approach;if(id==='memories')dest=game.world.memories.filter(m=>!m.taken).sort((a,b)=>Math.hypot(a.x-game.fox.group.position.x,a.z-game.fox.group.position.z)-Math.hypot(b.x-game.fox.group.position.x,b.z-game.fox.group.position.z))[0];if(dest){start();$('map-dialog').close();mobile.closeJournal();game.navigate(dest.x,dest.z);}else game.hud.toast('所有校园记忆都已经装进背包啦。');};
 $('map-destinations').onclick=e=>{const b=e.target.closest('[data-destination]');if(b)go(b.dataset.destination);};
 $('task-list').onclick=e=>{const b=e.target.closest('[data-task]');if(b)go(b.dataset.task);};
 $('large-map').onclick=e=>{
  const r=e.currentTarget.getBoundingClientRect(),x=((e.clientX-r.left)/r.width-.5)*campus.mapBounds.width,z=((e.clientY-r.top)/r.height-.5)*campus.mapBounds.depth;
  // Map labels are real destinations, not dead decoration on the canvas.
  const marks=campus.landmarks.filter(m=>game.mapZone==='all'||m.zone===game.mapZone);
  const hit=marks.find(m=>Math.abs(x-m.x)<13&&z>m.z-9&&z<m.z+2);
  if(hit){go(hit.id);return;}start();$('map-dialog').close();game.navigate(x,z);
 };
 return {
  start,
  character(character){
   document.querySelectorAll('[data-character]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.character===character.id)));
   $('welcome-name').textContent=character.name;$('minimap-player-name').textContent=character.name;$('player-name').textContent=character.title+' · '+character.name;$('player-portrait').src='./'+character.portrait;
   $('character-btn').setAttribute('title','当前：'+character.name+' · 点击切换角色');
  },
  update(done,memories){
   const mem=memories.filter(m=>m.taken).length,key=[...done].join(',')+mem;if(key===signature)return;signature=key;
   const landmarkTotal=campus.tasks.filter(t=>t.id!=='memories').length,landmarkDone=campus.tasks.filter(t=>t.id!=='memories'&&done.has(t.id)).length;
   const pc=Math.round((landmarkDone+mem)/(landmarkTotal+memories.length)*100);
   mobile.progress(pc);
   $('progress-fill').style.width=pc+'%';$('progress-percent').textContent=pc+'%';$('task-count').textContent=done.size+' / '+campus.tasks.length;$('memory-count').textContent=mem;$('level').textContent='Lv. '+String(1+Math.floor(pc/25)).padStart(2,'0');$('progress-label').textContent=pc===100?'所有小冒险，都成为了回忆。':`${landmarkDone}/${landmarkTotal} 地标 · ${mem}/${memories.length} 记忆`;renderTasks();renderDestinations();
  },
  say(title,body){mobile.say(title,body);$('speech').hidden=false;$('speech-title').textContent=title;$('speech-body').textContent=body;},
  hideSpeech(){mobile.hideSpeech();$('speech').hidden=true;},
  toast(message){clearTimeout(timer);$('toast').hidden=false;$('toast').textContent=message;timer=setTimeout(()=>$('toast').hidden=true,3300);},
  showComplete(){open('complete-dialog');},
  location(name,district){$('location-name').textContent=name;$('district-name').textContent=district;}
 };
}

export function drawMap(canvas,game,large=false){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,{width:mw,depth:md}=game.campus.mapBounds,px=x=>(x/mw+.5)*w,pz=z=>(z/md+.5)*h;
 ctx.fillStyle='#e6e6cf';ctx.fillRect(0,0,w,h);
 for(const d of game.campus.districts){ctx.fillStyle=d.tint;ctx.fillRect(px(d.x-d.w/2),pz(d.z-d.d/2),d.w/mw*w,d.d/md*h);}
 ctx.strokeStyle='#bac8ab55';ctx.lineWidth=1;for(let x=0;x<w;x+=w/24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=h/20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 for(const t of game.world.treeSpots){ctx.fillStyle=t.cherry?'#cca8a466':'#79996c65';ctx.beginPath();ctx.arc(px(t.x),pz(t.z),t.scale*w/mw,0,Math.PI*2);ctx.fill();}
 for(const r of game.campus.regions){
  if(!['path','plaza','road','sports','water','building'].includes(r.type))continue;
  ctx.fillStyle=r.type==='road'?'#a4a596':r.type==='sports'?'#b7806a':r.type==='water'?'#93b9ab':r.type==='building'?'#acaa8e':'#f6efcf';const extent=regionFootprint(r),rw=extent.w/mw*w,rd=extent.d/md*h;
  if(r.type==='sports'){ctx.beginPath();ctx.ellipse(px(r.x),pz(r.z),rw/2,rd/2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9fb784';ctx.beginPath();ctx.ellipse(px(r.x),pz(r.z),rw*.37,rd*.36,0,0,Math.PI*2);ctx.fill();continue;}
  ctx.fillRect(px(r.x)-rw/2,pz(r.z)-rd/2,rw,rd);
  if(r.type==='building'){ctx.strokeStyle='#858f72';ctx.lineWidth=large?1:.4;ctx.strokeRect(px(r.x)-rw/2,pz(r.z)-rd/2,rw,rd);}
 }
 for(const c of game.campus.crossings){ctx.fillStyle='#f8f2da';for(let dz=-4;dz<5;dz+=2)ctx.fillRect(px(c.x-2),pz(c.z+dz),4/mw*w,.8/md*h);}
 if(large){ctx.textAlign='center';ctx.font='12px "Microsoft YaHei"';for(const road of game.campus.regions.filter(r=>['road','path'].includes(r.type)&&r.label)){ctx.fillStyle=road.type==='road'?'#f8f3df':'#5d7052';ctx.fillText(road.label,px(road.x),pz(road.z)+4);}ctx.font='11px "Microsoft YaHei"';for(const d of game.campus.districts){ctx.fillStyle='#718762';ctx.fillText(d.name,px(d.x),pz(d.z-d.d/2)+15);}}
 if(game.route.length){ctx.strokeStyle='#bb883c';ctx.lineWidth=large?2.5:1.4;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(px(game.fox.group.position.x),pz(game.fox.group.position.z));game.route.forEach(p=>ctx.lineTo(px(p.x),pz(p.z)));ctx.stroke();ctx.setLineDash([]);}
 for(const m of game.world.memories){if(m.taken)continue;ctx.fillStyle='#b89742';ctx.font=`${large?14:8}px serif`;ctx.textAlign='center';ctx.fillText('✦',px(m.x),pz(m.z));}
 if(large){for(const m of game.world.landmarks){
  if(game.mapZone!=='all'&&game.mapZone!==m.zone)continue;
  ctx.font='bold 12px "Microsoft YaHei"';const label=(m.checked?'✓ ':'')+m.title,ww=ctx.measureText(label).width+12;
  ctx.fillStyle=['teaching-four','lidasan','shidai'].includes(m.id)?'#f4deb0f5':'#fbf7e9f5';ctx.fillRect(px(m.x)-ww/2,pz(m.z)-21,ww,20);ctx.strokeStyle='#bac1a588';ctx.lineWidth=.7;ctx.strokeRect(px(m.x)-ww/2,pz(m.z)-21,ww,20);ctx.fillStyle='#4a6549';ctx.textAlign='center';ctx.fillText(label,px(m.x),pz(m.z)-7);
 }}
 const p=game.fox.group.position;ctx.fillStyle='#d38b40';ctx.strokeStyle='#fff8dd';ctx.lineWidth=large?3:2;ctx.beginPath();ctx.arc(px(p.x),pz(p.z),large?6:4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#6b825e';ctx.font=`${large?12:8}px Georgia`;ctx.textAlign='right';ctx.fillText('N ↑',w-10,large?22:14);
}
