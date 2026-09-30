import { Game } from './game/Game.js';
import { loadCampusPackage } from './data/campusPackage.js';
import { loadLocalCampus } from './data/localCampuses.js';
import { bindCampusImport } from './ui/campusImport.js';
import { bindZhihuAuth } from './ui/zhihuAuth.js';
import { loadCloudCampus } from './data/cloudCampuses.js';
async function main(){
bindCampusImport();
bindZhihuAuth();
try {
 const params=new URLSearchParams(location.search),slug=params.get('campus'),local=params.get('localCampus'),cloud=params.get('cloudCampus');
 const shared=cloud?await loadCloudCampus(cloud):null;
 const campus=shared?.campus||(local?await loadLocalCampus(local):slug?await loadCampusPackage(slug):undefined);
 const game=new Game(document.getElementById('game-canvas'),campus,shared?null:local,shared?shared.owner+':'+cloud:null);
 window.__game=game;
 game.start();
} catch(error) {
 console.error('校园启动失败',error);
 const message=document.getElementById('error-message');message.textContent='校园启动失败：'+error.message;message.hidden=false;
}
}
main();
