// Reuse the existing journal DOM so filters, progress and navigation stay in sync.
export function bindMobileHud(game,openMap){
 const app=document.getElementById('app'),panel=document.getElementById('quest-panel');
 const anchor=document.createComment('desktop journal');panel.before(anchor);
 const controls=document.createElement('div');controls.className='mobile-hud interface';
 controls.innerHTML='<button id="mobile-quests" aria-haspopup="dialog" aria-controls="mobile-quest-dialog">⚑ 任务 <span id="mobile-progress">0%</span></button><button id="mobile-map" aria-label="展开校园地图" aria-haspopup="dialog">⌖ 地图</button><button id="mobile-story" hidden aria-haspopup="dialog" aria-controls="mobile-story-dialog"></button>';
 app.append(controls);
 const journal=document.createElement('dialog');journal.id='mobile-quest-dialog';journal.className='paper-dialog mobile-detail';journal.setAttribute('aria-labelledby','mobile-quest-title');
 journal.innerHTML='<div class="dialog-heading"><h2 id="mobile-quest-title">探索手记</h2><button data-close aria-label="关闭探索手记">×</button></div><p class="dialog-description">选择一项任务，沿着小路去看看。</p>';
 const story=document.createElement('dialog');story.id='mobile-story-dialog';story.className='paper-dialog mobile-detail';story.setAttribute('aria-labelledby','mobile-story-title');
 story.innerHTML='<div class="dialog-heading"><h2 id="mobile-story-title"></h2><button data-close aria-label="关闭故事详情">×</button></div><p id="mobile-story-body"></p>';
 app.append(journal,story);
 const $=id=>document.getElementById(id),media=matchMedia('(max-width: 700px), (pointer: coarse) and (max-height: 540px)');
 const show=dialog=>{game.input.reset();if(!dialog.open)dialog.showModal();};
 const sync=()=>{
  document.body.classList.toggle('compact-hud',media.matches);
  if(media.matches)journal.append(panel);else{journal.close();story.close();anchor.after(panel);}
 };
 media.addEventListener('change',sync);sync();
 $('mobile-quests').onclick=()=>show(journal);$('mobile-map').onclick=openMap;$('mobile-story').onclick=()=>show(story);
 return{
  compact:()=>media.matches,
  progress(value){$('mobile-progress').textContent=value+'%';},
  say(title,body){$('mobile-story').textContent='✦ '+title+' · 查看故事';$('mobile-story').hidden=false;$('mobile-story-title').textContent=title;$('mobile-story-body').textContent=body;},
  hideSpeech(){$('mobile-story').hidden=true;},
  closeJournal(){journal.close();}
 };
}
