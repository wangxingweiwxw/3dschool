import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  await page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
  await page.wait_for_timeout(1600)
  await page.screenshot(path='artifacts/campus-welcome.png')
  print(json.dumps({'errors':errors,'game':await page.evaluate('''() => window.__game ? {calls:__game.renderer.info.render.calls,triangles:__game.renderer.info.render.triangles,trees:__game.world.treeSpots.length,blocked:__game.blocked(0,27),routes:__game.campus.landmarks.map(m=>({id:m.id,length:__game.nav.find(__game.fox.group.position,m.approach).length})),memories:__game.world.memories.map(m=>({id:m.id,length:__game.nav.find(__game.fox.group.position,m).length}))}:null''')},ensure_ascii=False))
  await page.get_by_role('button',name='出发，去逛逛').click()
  await page.wait_for_timeout(1800)
  await page.screenshot(path='artifacts/campus-play.png')
  await browser.close()
asyncio.run(main())
