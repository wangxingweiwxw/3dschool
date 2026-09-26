import { listLocalCampuses,loadLocalCampus,readCampusFile,removeLocalCampus,saveLocalCampus } from '../data/localCampuses.js';
import { builtinCampuses } from '../data/builtinCampuses.js';
import { loadCampusPackage } from '../data/campusPackage.js';

export function bindCampusImport(){
 const button=document.createElement('button');button.id='campus-btn';button.className='campus-tool';button.textContent='校园';button.title='导入或切换校园';button.setAttribute('aria-label','导入或切换校园');
 document.querySelector('.tools').prepend(button);
 const dialog=document.createElement('dialog');dialog.id='campus-dialog';dialog.className='paper-dialog campus-dialog';dialog.setAttribute('aria-labelledby','campus-import-title');
 dialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">A NEW CAMPUS JOURNEY</p><h2 id="campus-import-title">下一座校园，等你探索</h2></div><button id="campus-close" aria-label="关闭校园导入">×</button></div>
 <p class="dialog-description">选一座校园，开启新的漫游。每座校园的探索进度独立保存。</p>
 <div id="campus-builtins" class="campus-grid" aria-label="选择校园"></div>
 <p id="campus-switch-status" role="status" aria-live="polite"></p>
 <div class="campus-library-heading"><h3>带上你自己的校园</h3></div>
 <label class="campus-file-label" for="campus-file"><strong>导入校园文件</strong><span>campus.json 或完整模型包 .zip</span></label>
 <input id="campus-file" type="file" accept=".json,.zip,application/json,application/zip">
 <p class="campus-privacy">文件仅保存在当前浏览器，不上传服务器。单独的 GLB 文件不包含漫游数据。</p>
 <p id="campus-import-status" role="status" aria-live="polite"></p>
 <div id="campus-preview" hidden><h3 id="campus-preview-name"></h3><p id="campus-preview-detail"></p><button id="campus-enter" class="primary">进入这座校园 <span>↗</span></button></div>
 <div class="campus-library-heading"><h3>我的导入</h3></div>
 <p class="campus-privacy">不同校园分别保存进度。同名新版本也会保留旧版本。</p><div id="campus-library"></div>`;
 document.getElementById('app').append(dialog);
 const $=id=>document.getElementById(id),status=$('campus-import-status');let pending=null,reading=0,busy=false;
 const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('import-error',error);};
 const navigate=(key,slug=null)=>{window.__game?.save();const url=new URL(location.href);url.searchParams.delete('campus');url.searchParams.delete('localCampus');if(key)url.searchParams.set('localCampus',key);else if(slug)url.searchParams.set('campus',slug);location.assign(url.href);};
 const params=new URLSearchParams(location.search);
 const setBusy=value=>{busy=value;dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('button,input').forEach(control=>{if(value){control.dataset.wasDisabled=String(control.disabled);control.disabled=true;}else{control.disabled=control.dataset.wasDisabled==='true';delete control.dataset.wasDisabled;}});};
 for(const campus of builtinCampuses){
  const current=!params.has('localCampus')&&(campus.slug?params.get('campus')===campus.slug:!params.has('campus'));
  const card=document.createElement('button');card.type='button';card.className='campus-card';card.dataset.campus=campus.slug||'fudan';card.setAttribute('aria-label','进入'+campus.name);if(!campus.slug)card.id='campus-default';
  if(current){card.classList.add('is-current');card.setAttribute('aria-current','true');}
  const art=document.createElement('span');art.className='campus-card-art';
  if(campus.slug){const img=document.createElement('img');img.src=new URL(`campuses/${campus.slug}/preview.png`,document.baseURI).href;img.alt='';img.loading='lazy';art.append(img);}else{art.classList.add('campus-fudan-art');art.textContent=campus.mark;}
  const info=document.createElement('span');info.className='campus-card-info';
  const name=document.createElement('strong'),subtitle=document.createElement('span'),description=document.createElement('small'),badge=document.createElement('span');
  name.textContent=campus.name;subtitle.textContent=campus.subtitle;description.textContent=campus.description;badge.className='campus-card-action';badge.textContent=current?'当前校园':campus.slug?'进入校园 ↗':'默认校园 · 进入 ↗';
  info.append(name,subtitle,description,badge);card.append(art,info);$('campus-builtins').append(card);
  card.onclick=async()=>{
   if(busy)return;if(current){dialog.close();return;}
   const notice=$('campus-switch-status');setBusy(true);notice.classList.remove('import-error');notice.textContent='正在准备'+campus.name+'…';
   try{if(campus.slug)await loadCampusPackage(campus.slug);navigate(null,campus.slug);}
   catch(e){notice.textContent='校园加载失败：'+e.message;notice.classList.add('import-error');setBusy(false);}
  };
 }
 async function refresh(){
  const list=$('campus-library');list.replaceChildren();
  try{
   const saved=(await listLocalCampuses()).sort((a,b)=>b.importedAt-a.importedAt);
   if(!saved.length){const empty=document.createElement('p');empty.className='campus-privacy';empty.textContent='还没有导入校园，选一份文件开始吧。';list.append(empty);}
   for(const item of saved){
    const row=document.createElement('div');row.className='campus-library-row';
    const info=document.createElement('div'),name=document.createElement('strong'),date=document.createElement('small');name.textContent=item.payload.campus.name;date.textContent=new Date(item.importedAt).toLocaleString('zh-CN');info.append(name,date);
    const enter=document.createElement('button');enter.className='secondary';enter.textContent='进入';enter.setAttribute('aria-label','进入'+item.payload.campus.name);enter.onclick=async()=>{if(busy)return;setBusy(true);try{await loadLocalCampus(item.key);navigate(item.key);}catch(e){message(e.message,true);setBusy(false);}};
    const remove=document.createElement('button');remove.className='campus-remove';remove.textContent='移除';remove.setAttribute('aria-label','移除'+item.payload.campus.name);
    remove.disabled=new URLSearchParams(location.search).get('localCampus')===item.key;remove.title=remove.disabled?'请先切换到其他校园再移除':'移除本地校园文件，探索进度保留';
    remove.onclick=async()=>{if(busy)return;try{await removeLocalCampus(item.key);await refresh();}catch(e){message(e.message,true);}};
    row.append(info,enter,remove);list.append(row);
   }
  }catch(e){message(e.message,true);}
 }
 button.onclick=()=>{window.__game?.input.reset();if(!dialog.open)dialog.showModal();refresh();};
 $('campus-close').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 $('campus-file').onchange=async event=>{
  const file=event.target.files[0],token=++reading;pending=null;$('campus-preview').hidden=true;message('');if(!file)return;
  message('正在读取并校验校园…');
  try{const payload=await readCampusFile(file);if(token!==reading)return;pending=payload;const c=payload.campus;$('campus-preview-name').textContent=c.name;$('campus-preview-detail').textContent=`${c.regions.filter(r=>r.type==='building').length} 个建筑 · ${c.landmarks.length} 处探索点 · ${c.memories.length} 枚记忆`;$('campus-preview').hidden=false;message('文件结构校验通过，可以进入校园。');}
  catch(e){if(token===reading)message('导入失败：'+e.message,true);}
 };
 $('campus-enter').onclick=async()=>{
  if(!pending||busy)return;setBusy(true);message('正在保存校园…');
  try{const key=await saveLocalCampus(pending);navigate(key);}catch(e){message('导入失败：'+e.message,true);setBusy(false);}
 };
}
