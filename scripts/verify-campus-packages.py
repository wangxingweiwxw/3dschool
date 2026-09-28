"""Exercise imported campuses, gameplay, save isolation, and rejected inputs."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':1440,'height':900});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
  await page.wait_for_function('window.__game')
  original=await page.evaluate('()=>{__game.selectCharacter("ming");__game.save();return localStorage.getItem(__game.saveKey)}')
  await page.goto('http://127.0.0.1:5173/?campus=example-school-v1',wait_until='networkidle')
  await page.wait_for_function('window.__game')
  assert await page.evaluate('__game.campus.id')=='example-school-v1'
  assert '示例学校' in await page.title()
  assert 'FUDAN' not in await page.locator('#welcome').inner_text()
  await page.locator('#start-btn').click()
  before=await page.evaluate('__game.fox.group.position.z')
  await page.keyboard.down('w');await page.wait_for_timeout(700);await page.keyboard.up('w')
  assert await page.evaluate('__game.fox.group.position.z')<before-.4
  await page.keyboard.press('m');await page.locator('#map-destinations button').nth(1).click()
  assert await page.evaluate('__game.route.length')>0
  journey=await page.evaluate('''()=>{
   const g=__game;cancelAnimationFrame(g.frame);g.resetWorld(true);g.hud.start();const visits=[];
   for(const mark of g.campus.landmarks){g.navigate(mark.approach.x,mark.approach.z);let ticks=0;while(g.route.length&&ticks++<9000)g.updatePlayer(1/30);visits.push({id:mark.id,remaining:g.route.length});}
   for(const m of g.world.memories){if(m.taken)continue;g.navigate(m.x,m.z);let ticks=0;while(g.route.length&&ticks++<9000)g.updatePlayer(1/30);}
   document.querySelectorAll('dialog[open]').forEach(d=>d.close());g.selectCharacter('nana');g.setTimeOfDay('night',{instant:true});g.save();g.tick();
   return {visits,completed:g.completed,memories:g.world.memories.filter(m=>m.taken).length,saveKey:g.saveKey,occlusion:!!g.world.occlusion};
  }''')
  assert journey['completed'] and journey['occlusion'] and all(x['remaining']==0 for x in journey['visits']),journey
  await page.wait_for_timeout(500);await page.screenshot(path='artifacts/imported-campus-night.png')
  assert await page.evaluate("localStorage.getItem('fudan-garden-adventure-v2')")==original
  await page.reload(wait_until='networkidle');await page.wait_for_function('window.__game')
  assert await page.evaluate('__game.timeOfDay')=='night'
  assert await page.evaluate('__game.characterId')=='nana'
  assert await page.evaluate('__game.completed')
  rejected=await page.evaluate('''async()=>{
   cancelAnimationFrame(__game.frame);
   const {validateCampusPackage}=await import('/src/data/campusPackage.js');
   const {buildCampusPackage}=await import('/src/tools/campusPackageBuilder.js');
   const data=await(await fetch('/campuses/example-school-v1/campus.json')).json();const rejected=[];
   for(const [name,edit] of [['fractional-bounds',p=>p.campus.bounds.width=95.5],['unknown-recipe',p=>p.campus.regions.find(r=>r.type==='building').recipe='invalid'],['html-object',p=>p.campus.landmarks[0].title={text:'bad'}]]){
    const copy=structuredClone(data);edit(copy);let failed=false;try{validateCampusPackage(copy)}catch(e){failed=true;rejected.push(name)}if(!failed)throw Error('Accepted '+name);
   }
   const bad=structuredClone(data),building=bad.campus.regions.find(r=>r.recipe==='teaching-block');bad.campus.spawn.x=building.x;bad.campus.spawn.z=building.z;
   let failed=false;try{await buildCampusPackage(bad)}catch(e){if(!e.message.includes('出生点'))throw e;failed=true;rejected.push('blocked-spawn')}if(!failed)throw Error('Accepted blocked spawn');return rejected;
  }''')
  await page.goto('http://127.0.0.1:5173/?campus=fudan-map-package-v1',wait_until='networkidle');await page.wait_for_function('window.__game')
  buildings=await page.evaluate('__game.campus.regions.filter(r=>r.type==="building").length')
  assert buildings>=30
  await page.goto('http://127.0.0.1:5173/?campus=../bad',wait_until='networkidle')
  assert await page.locator('#error-message').is_visible()
  assert await page.evaluate('!window.__game')
  await page.goto('http://127.0.0.1:5173/',wait_until='networkidle');await page.wait_for_function('window.__game')
  assert await page.evaluate('__game.characterId')=='ming'
  assert await page.evaluate('__game.saveKey')=='fudan-garden-adventure-v2'
  assert not errors,errors
  result={'journey':journey,'rejected':rejected,'fudanBuildings':buildings,'saveIsolation':True,'errors':errors}
  Path('artifacts/campus-package-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
  print(json.dumps(result,ensure_ascii=False));await browser.close()

asyncio.run(main())
