import { regionFootprint } from '../world/voxel.js';

import { validateCampus } from '../world/validateCampus.js';

const idPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
const regionTypes = new Set(['path','plaza','road','sports','water','building','prop-row']);
const fail = message => { throw new TypeError(`校园包：${message}`); };
const text = (value,path) => { if(typeof value!=='string'||!value.trim()||value.length>1500)fail(`${path} 必须是非空文本（最多 1500 字）`); };
const number = (value,path,min=-1000,max=1000) => { if(!Number.isFinite(value)||value<min||value>max)fail(`${path} 必须在 ${min} 到 ${max} 之间`); };
const id = (value,path) => { if(typeof value!=='string'||!idPattern.test(value))fail(`${path} 只能使用小写字母、数字和连字符`); };
const unique = (items,path) => { const seen=new Set();for(const item of items){id(item.id,`${path}.id`);if(seen.has(item.id))fail(`${path} 重复 ID：${item.id}`);seen.add(item.id);}return seen; };

/** JSON-only interchange contract. No executable scripts or external asset URLs. */
export function validateCampusPackage(payload) {
  if(payload?.format!=='3dschool-campus'||payload.version!==1)fail('需要 format=3dschool-campus、version=1');
  const c=payload.campus;validateCampus(c);id(c.id,'campus.id');text(c.name,'campus.name');
  for(const k of ['width','depth']){
    number(c.bounds[k],`bounds.${k}`,24,300);if(!Number.isInteger(c.bounds[k]))fail('bounds 必须是整数，供寻路网格使用');
    number(c.mapBounds?.[k],`mapBounds.${k}`,c.bounds[k],340);
  }
  for(const key of ['districts','crossings','swans'])if(!Array.isArray(c[key]))fail(`${key} 必须是数组，允许 crossings / swans 为空`);
  if(!c.districts.length||!c.tasks.length||!c.landmarks.length||!c.memories.length)fail('至少需要一个片区、任务、地标和记忆点');
  if(c.regions.length>500||c.landmarks.length>80||c.memories.length>100||c.districts.length>30)fail('地图超过 v1 体量上限');
  const point=(p,path)=>{number(p?.x,`${path}.x`,-c.bounds.width/2+1.5,c.bounds.width/2-1.5);number(p?.z,`${path}.z`,-c.bounds.depth/2+1.5,c.bounds.depth/2-1.5);};
  point(c.spawn,'spawn');number(c.spawn.yaw,'spawn.yaw',-Math.PI*2,Math.PI*2);
  point(c.intro,'intro');number(c.intro?.size,'intro.size',23,180);
  const districts=unique(c.districts,'districts'),tasks=unique(c.tasks,'tasks');unique(c.landmarks,'landmarks');unique(c.regions,'regions');unique(c.memories,'memories');
  for(const d of c.districts){text(d.name,'district.name');point(d,'district');number(d.w,'district.w',1,300);number(d.d,'district.d',1,300);if(!/^#[a-fA-F0-9]{6}$/.test(d.tint))fail('district.tint 需要 #RRGGBB');}
  for(const t of c.tasks){text(t.label,'task.label');text(t.icon,'task.icon');if(t.zone!=='all'&&!districts.has(t.zone))fail(`任务 ${t.id} 的 zone 不存在`);}
  if(!tasks.has('memories'))fail('需要 id=memories 的收集任务');
  const referenced=new Set(['memories']);
  for(const m of c.landmarks){for(const key of ['title','quote','speech'])text(m[key],`landmark.${key}`);point(m,'landmark');point(m.approach,`landmark ${m.id}.approach`);number(m.labelY,'labelY',1,45);number(m.radius,'radius',1,8);if(!districts.has(m.zone))fail(`地标 ${m.id} 的 zone 不存在`);if(m.taskId){if(!tasks.has(m.taskId))fail(`未知任务 ${m.taskId}`);referenced.add(m.taskId);}}
  for(const t of tasks)if(!referenced.has(t))fail(`任务 ${t} 没有完成触发点`);
  for(const m of c.memories){point(m,'memory');text(m.title,'memory.title');text(m.text,'memory.text');}
  for(const r of c.regions){
    if(!regionTypes.has(r.type))fail(`尚未实现的区域类型 ${r.type}`);number(r.x,`${r.id}.x`);number(r.z,`${r.id}.z`);
    if(r.rotation!==undefined&&r.rotation!==0){
      number(r.rotation,`${r.id}.rotation`,-Math.PI*2,Math.PI*2);
      if(r.type!=='building'||!['ceremonial-gate','small-gate'].includes(r.recipe)||Math.abs(r.rotation/(Math.PI/2)-Math.round(r.rotation/(Math.PI/2)))>1e-8)
        fail(`${r.id}：仅校门支持 90 度整数倍 rotation；其他配方仍为 0`);
    }
    if(r.showSign!==undefined&&typeof r.showSign!=='boolean')fail(`${r.id}.showSign 必须是布尔值`);
    if(r.type==='prop-row'){
      if(!['lamp','bench'].includes(r.kind))fail(`${r.id}.kind 需要 lamp / bench`);
      number(r.count,`${r.id}.count`,1,60);if(!Number.isInteger(r.count))fail('prop-row.count 必须是整数');
      number(r.dx??0,`${r.id}.dx`,-300,300);number(r.dz??0,`${r.id}.dz`,-300,300);
    }else{
      number(r.w,`${r.id}.w`,.5,300);number(r.d,`${r.id}.d`,.5,300);
      const extent=regionFootprint(r);if(Math.abs(r.x)+extent.w/2>c.bounds.width/2+1e-8||Math.abs(r.z)+extent.d/2>c.bounds.depth/2+1e-8)fail(`${r.id} 超出地图边界`);
    }
    if(r.type==='building'){
      text(r.label,`${r.id}.label`);number(r.h,`${r.id}.h`,1,30);
      if(r.floors!==undefined){number(r.floors,`${r.id}.floors`,1,10);if(!Number.isInteger(r.floors))fail('floors 必须是整数');}
      if(r.front!==undefined&&(r.recipe!=='business-school'||![1,-1].includes(r.front)))fail('front 仅支持 business-school 的 1 / -1');
    }
  }
  c.crossings.forEach(p=>point(p,'crossing'));c.swans.forEach(p=>point(p,'swan'));
  if(c.palette)for(const [key,value] of Object.entries(c.palette))number(value,`palette.${key}`,0,0xffffff);
  return c;
}

export async function loadCampusPackage(slug) {
  id(slug,'URL campus');
  const url=new URL(`campuses/${slug}/campus.json`,document.baseURI);
  const response=await fetch(url);
  if(!response.ok)throw new Error(`校园包加载失败（${response.status}）：${slug}`);
  const payload=await response.json();
  const campus=validateCampusPackage(payload);
  if(campus.id!==slug)fail('文件夹名称与 campus.id 不一致');
  return campus;
}
