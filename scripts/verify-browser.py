import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
  page=await context.new_page();errors=[];failures=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.on('requestfailed',lambda r:failures.append(r.url))
  await page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
  await page.wait_for_function('window.__game && __game.world')
  await page.wait_for_timeout(700)
  await page.screenshot(path='artifacts/campus-welcome.png')
  await page.get_by_role('button',name='出发，去逛逛').click()
  await page.keyboard.down('w');await page.wait_for_timeout(850);await page.keyboard.up('w')
  keyboard=await page.evaluate('({x:__game.fox.group.position.x,z:__game.fox.group.position.z,done:[...__game.done]})')
  counts=await page.evaluate('({tasks:__game.campus.tasks.length,memories:__game.campus.memories.length,spawn:__game.campus.spawn})')
  assert keyboard['z']<counts['spawn']['z']-1,keyboard
  await page.wait_for_timeout(900)
  await page.screenshot(path='artifacts/campus-play.png')
  await page.keyboard.press('m');assert await page.locator('#map-dialog').is_visible()
  await page.wait_for_timeout(250)
  await page.screenshot(path='artifacts/campus-map.png')
  await page.locator('#map-zone').select_option('south')
  assert await page.get_by_role('button',name='⌖ 李达三楼',exact=True).count()==1
  assert await page.get_by_role('button',name='⌖ 第四教学楼',exact=True).count()==0
  await page.locator('#map-zone').select_option('all')
  await page.get_by_role('button',name='⌖ 相辉堂',exact=True).click()
  assert not await page.locator('#map-dialog').is_visible()
  assert await page.evaluate('__game.route.length')>0
  # Exercise actual movement and checkpoint methods at a fixed timestep, without thousands of GPU frames.
  journey=await page.evaluate('''() => {
    const g=__game;cancelAnimationFrame(g.frame);g.input.keys.clear();g.resetWorld(true);g.hud.start();
    const results=[];let allSegmentsClear=true;
    for(const mark of g.campus.landmarks){
      const ok=g.navigate(mark.approach.x,mark.approach.z);let previous={x:g.fox.group.position.x,z:g.fox.group.position.z};
      for(const next of g.route){if(!g.nav.clear(previous,next))allSegmentsClear=false;previous=next;}
      let ticks=0;while(g.route.length&&ticks++<9000)g.updatePlayer(1/30);
      results.push({id:mark.id,ok,ticks,remaining:g.route.length,checked:g.world.landmarks.find(m=>m.id===mark.id).checked});
    }
    for(const memory of g.world.memories){if(memory.taken)continue;g.navigate(memory.x,memory.z);let ticks=0;while(g.route.length&&ticks++<9000)g.updatePlayer(1/30);results.push({id:memory.id,ticks,taken:memory.taken});}
    const completed=g.completed,done=[...g.done],memories=g.world.memories.filter(m=>m.taken).length;
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    const hall=g.campus.landmarks.find(m=>m.id==='xianghui');g.fox.setPose(hall.approach.x,hall.approach.z,Math.PI);let penetration=false;for(let i=0;i<120;i++){g.tryMove(0,-.1);if(g.blocked(g.fox.group.position.x,g.fox.group.position.z))penetration=true;}
    g.save();return{results,allSegmentsClear,completed,done,memories,penetration,calls:g.renderer.info.render.calls};
  }''')
  assert journey['allSegmentsClear'],journey
  assert all(r.get('remaining',0)==0 for r in journey['results']),journey
  assert journey['completed'] and journey['memories']==counts['memories'] and len(journey['done'])==counts['tasks'],journey
  assert not journey['penetration'],journey
  await page.reload(wait_until='networkidle')
  persisted=await page.evaluate('({done:__game.done.size,memories:__game.world.memories.filter(m=>m.taken).length})')
  assert persisted=={'done':counts['tasks'],'memories':counts['memories']},persisted
  await page.get_by_role('button',name='出发，去逛逛').click()
  await page.get_by_role('button',name='切换时段：午后、黄昏、夜晚',exact=True).click();assert await page.evaluate('__game.evening')
  await page.get_by_role('button',name='开启环境音乐',exact=True).click();assert await page.locator('#sound-btn').get_attribute('aria-pressed')=='true'
  await page.get_by_role('button',name='关闭环境音乐',exact=True).click()
  await page.wait_for_timeout(1200)
  await page.screenshot(path='artifacts/campus-evening.png')
  async with page.expect_download() as download_info:
   await page.get_by_role('button',name='保存校园照片',exact=True).click()
  download=await download_info.value;await download.save_as('artifacts/campus-postcard.png')
  await page.get_by_role('button',name='操作帮助',exact=True).click()
  await page.get_by_role('button',name='重新开始这次旅行').click()
  assert await page.evaluate('__game.done.size')==0
  # Keyboard movement must stop when focus leaves the page.
  await page.keyboard.down('w');await page.evaluate("window.dispatchEvent(new Event('blur'))")
  assert await page.evaluate('__game.input.keys.size')==0
  await page.keyboard.up('w')
  # Pointer rotation and wheel change the view, and a ground click starts a path.
  angle=await page.evaluate('__game.angle')
  await page.mouse.move(800,500);await page.mouse.down();await page.mouse.move(930,500,steps=8);await page.mouse.up()
  assert abs(await page.evaluate('__game.angle')-angle)>.3
  zoom=await page.evaluate('__game.zoom');await page.mouse.wheel(0,100)
  assert await page.evaluate('__game.zoom')>zoom
  await page.mouse.click(850,610);assert await page.evaluate('__game.route.length')>0
  # Mobile: real touch input and modal fit at a narrow viewport.
  mobile=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
  mp=await mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)))
  await mp.goto('http://127.0.0.1:5173/',wait_until='networkidle');await mp.wait_for_timeout(400)
  await mp.screenshot(path='artifacts/campus-mobile-welcome.png')
  await mp.get_by_role('button',name='出发，去逛逛').tap();await mp.wait_for_timeout(1200)
  await mp.screenshot(path='artifacts/campus-mobile.png')
  before_touch=await mp.evaluate('__game.fox.group.position.z')
  bounds=await mp.locator('#virtual-joystick').bounding_box()
  cdp=await mobile.new_cdp_session(mp)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':bounds['x']+bounds['width']/2,'y':bounds['y']+12}]})
  await mp.wait_for_timeout(500)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  assert await mp.evaluate('__game.fox.group.position.z')<before_touch-.2
  assert await mp.evaluate('__game.input.keys.size')==0
  await mp.get_by_role('button',name='展开校园地图',exact=True).first.tap()
  assert await mp.locator('#map-dialog').is_visible()
  await mp.screenshot(path='artifacts/campus-mobile-map.png')
  layout=await mp.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,dialog:document.querySelector("#map-dialog").getBoundingClientRect().toJSON()})')
  assert layout['width']==layout['scroll'],layout
  assert not errors,errors
  assert not failures,failures
  result={'keyboard':keyboard,'journey':journey,'persisted':persisted,'download':download.suggested_filename,'mobileLayout':layout,'errors':errors,'failedRequests':failures}
  Path('artifacts/verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
  print(json.dumps(result,ensure_ascii=False))
  await browser.close()
asyncio.run(main())
