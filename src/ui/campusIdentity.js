export const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function applyCampusIdentity(campus) {
  const name=campus.name;
  document.title=name+' · 校园漫游';
  document.querySelector('meta[name="description"]').content='选择你的漫游伙伴，探索'+name+'的校园与故事。';
  document.getElementById('game-canvas').setAttribute('aria-label',name+' 3D 校园，使用 WASD 移动或点击地面寻路');
  const brand=document.querySelector('.brand');brand.setAttribute('aria-label',name+'漫游首页');brand.href=location.pathname+location.search;
  brand.querySelector('.brand-seal').textContent=name.slice(0,1);
  brand.lastElementChild.firstChild.textContent=name+'漫游';brand.querySelector('small').textContent='CAMPUS · A LITTLE ADVENTURE';
  const chapter=document.querySelector('.chapter');[...chapter.childNodes].find(n=>n.nodeType===3&&n.textContent.trim()).textContent=' 校园探索 ';
  document.querySelector('#welcome h1').firstChild.textContent='在'+name+'，';
  const edition=document.querySelector('#welcome .edition');[...edition.childNodes].find(n=>n.nodeType===3&&n.textContent.trim()).textContent=' CAMPUS ADVENTURE ';
  const intro=document.querySelector('#welcome .intro');intro.firstChild.textContent='沿着地图上的小路，发现校园故事。';intro.lastChild.textContent='一起，探索'+name+'。';
  document.querySelector('.quest-sub').textContent='今天的校园，还有新的故事';
  document.getElementById('location-name').textContent='校园入口';document.getElementById('district-name').textContent=campus.districts[0].name;
  document.querySelector('#map-dialog .dialog-description').textContent='选择地标步行前往，或点击地图上的目的地。';
  document.querySelector('.map-note').textContent='依据提供的学校地图重建相对布局，建筑高度与外观为艺术化表达。';
  document.querySelector('#complete-dialog h2').textContent='把'+name+'，装进回忆里。';
  document.querySelector('.stamp').firstChild.textContent='校园探险家';document.querySelector('.stamp small').textContent='CAMPUS EXPLORER · 01';
  const help=document.querySelector('.help-grid');help.lastElementChild.textContent='自动打卡 / 收集校园记忆';
}
