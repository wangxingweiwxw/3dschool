import { Game } from './game/Game.js';
import { loadCampusPackage } from './data/campusPackage.js';
import { loadLocalCampus } from './data/localCampuses.js';
import { bindCampusImport } from './ui/campusImport.js';
async function main(){
bindCampusImport();
try {
 const params=new URLSearchParams(location.search),slug=params.get('campus'),local=params.get('localCampus');
 const campus=local?await loadLocalCampus(local):slug?await loadCampusPackage(slug):undefined;
 const game=new Game(document.getElementById('game-canvas'),campus,local);
 window.__game=game;
 game.start();
} catch(error) {
 console.error('校园启动失败',error);
 const message=document.getElementById('error-message');message.textContent='校园启动失败：'+error.message;message.hidden=false;
}
}
main();
