import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
  errors=[];results=[]
  for width,height in [(390,844),(360,640),(844,390)]:
   context=await browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,device_scale_factor=1)
   page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto('http://127.0.0.1:5173/',wait_until='networkidle');await page.wait_for_function('window.__game')
   await page.locator('#start-btn').tap();await page.wait_for_timeout(700)
   assert await page.evaluate('document.body.classList.contains("compact-hud")')
   assert not await page.locator('#quest-panel').is_visible()
   assert not await page.locator('.minimap-panel').is_visible()
   await page.evaluate('()=>{__game.hud.say("相辉堂", "岁月相辉，故事长青。这里是一段完整的校园故事，点击后再阅读，行走时不遮挡角色。");__game.speechTimer=60;}')
   assert not await page.locator('#speech').is_visible()
   assert await page.locator('#mobile-story').is_visible()
   await page.screenshot(path=f'artifacts/mobile-hud-{width}x{height}.png')
   clear=await page.evaluate('''()=>({
    center:[.4,.5,.6].map(y=>document.elementFromPoint(innerWidth*.5,innerHeight*y)?.id),
    scroll:document.documentElement.scrollWidth,width:innerWidth,
    labels:__game.world.landmarks.filter(m=>m.label.visible).length,
    controls:[...document.querySelectorAll('.mobile-hud>button:not([hidden]),#virtual-joystick,#character-btn')].map(b=>({id:b.id||b.dataset.key,...b.getBoundingClientRect().toJSON()}))
   })''')
   assert clear['scroll']==width and clear['labels']<=1,clear
   assert all(x=='game-canvas' for x in clear['center']),clear
   assert all(r['x']>=0 and r['right']<=width and r['y']>=0 and r['bottom']<=height for r in clear['controls']),clear
   # Story details pause motion; closing returns to an unobstructed scene.
   await page.locator('#mobile-story').tap();assert await page.locator('#mobile-story-dialog').is_visible()
   await page.evaluate('__game.route=__game.nav.find(__game.fox.group.position,{x:-44,z:5})')
   pos=await page.evaluate('__game.fox.group.position.toArray()')
   await page.wait_for_timeout(350);assert await page.evaluate('__game.fox.group.position.toArray()')==pos
   assert '完整的校园故事' in await page.locator('#mobile-story-body').inner_text()
   await page.get_by_role('button',name='关闭故事详情',exact=True).tap()
   await page.locator('#mobile-quests').tap()
   pos=await page.evaluate('__game.fox.group.position.toArray()')
   await page.keyboard.press('w');await page.wait_for_timeout(200);assert await page.evaluate('__game.fox.group.position.toArray()')==pos
   await page.locator('#quest-zone').select_option('south')
   assert await page.locator('[data-task="lidasan"]').is_visible()
   await page.screenshot(path=f'artifacts/mobile-journal-{width}x{height}.png')
   await page.locator('[data-task="lidasan"]').tap()
   assert not await page.locator('#mobile-quest-dialog').is_visible()
   assert await page.evaluate('__game.route.length')>0
   # Touch controls remain reachable and cancel navigation normally.
   button=await page.locator('#virtual-joystick').bounding_box();cdp=await context.new_cdp_session(page)
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':button['x']+button['width']/2,'y':button['y']+12}]})
   await page.wait_for_timeout(250);await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   assert await page.evaluate('__game.route.length')==0
   assert await page.evaluate('__game.input.keys.size')==0
   await page.locator('#mobile-map').tap();assert await page.locator('#map-dialog').is_visible()
   await page.get_by_role('button',name='关闭地图',exact=True).tap()
   results.append({'viewport':[width,height],'centerClear':True,'taskNavigation':True,'storyPause':True,'touch':True,'layout':clear})
   await context.close()
  # Desktop retains its journal; resizing safely moves the same DOM and handlers.
  desktop=await browser.new_page(viewport={'width':1440,'height':900});desktop.on('pageerror',lambda e:errors.append(str(e)))
  await desktop.goto('http://127.0.0.1:5173/',wait_until='networkidle');await desktop.locator('#start-btn').click()
  assert await desktop.locator('#quest-panel').is_visible()
  await desktop.set_viewport_size({'width':390,'height':844});await desktop.locator('#mobile-quests').click()
  await desktop.set_viewport_size({'width':1440,'height':900})
  await desktop.wait_for_function('document.querySelector("#quest-panel").parentElement.id==="app"')
  assert not await desktop.locator('#mobile-quest-dialog').is_visible()
  assert await desktop.locator('#task-list').count()==1
  assert await desktop.locator('#quest-panel').is_visible()
  assert not errors,errors
  Path('artifacts/mobile-hud-verification.json').write_text(json.dumps({'viewports':results,'desktopRestore':True,'errors':errors},ensure_ascii=False,indent=2),encoding='utf8')
  print(json.dumps({'viewports':[r['viewport'] for r in results],'desktopRestore':True,'errors':errors}));await browser.close()

asyncio.run(main())
