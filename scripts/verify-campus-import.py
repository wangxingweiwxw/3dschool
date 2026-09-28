import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT='http://127.0.0.1:5173/'
JSON_FILE='artifacts/skill-template-packages/example-school-v1/campus.json'
ZIP_FILE='artifacts/skill-template-packages/example-school-v1.zip'

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':1440,'height':900});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(ROOT,wait_until='networkidle');await page.wait_for_function('window.__game')
  await page.evaluate('__game.selectCharacter("ming");__game.save()')
  await page.locator('#campus-btn').click()
  await page.locator('#campus-file').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{oops'})
  await page.wait_for_function('document.querySelector("#campus-import-status").textContent.includes("导入失败")')
  assert not await page.locator('#campus-preview').is_visible()
  await page.locator('#campus-file').set_input_files(JSON_FILE)
  await page.locator('#campus-preview').wait_for(state='visible')
  assert await page.locator('#campus-preview-name').inner_text()=='示例学校'
  await page.screenshot(path='artifacts/campus-import-desktop.png')
  await page.locator('#campus-enter').click();await page.wait_for_url('**/*localCampus=*');await page.wait_for_function('window.__game?.campus.id==="example-school-v1"')
  first_url=page.url
  await page.locator('#start-btn').click();z=await page.evaluate('__game.fox.group.position.z')
  await page.keyboard.down('w');await page.wait_for_timeout(500);await page.keyboard.up('w')
  assert await page.evaluate('__game.fox.group.position.z')<z-.2
  await page.evaluate('__game.selectCharacter("nana");__game.setTimeOfDay("night");__game.save()')
  await page.reload(wait_until='networkidle');await page.wait_for_function('window.__game')
  assert await page.evaluate('__game.characterId')=='nana'
  assert await page.evaluate('__game.timeOfDay')=='night'
  await page.locator('#campus-btn').click();await page.locator('#campus-default').click();await page.wait_for_url(ROOT);await page.wait_for_function('window.__game')
  assert await page.evaluate('__game.characterId')=='ming'
  await page.locator('#campus-btn').click()
  await page.locator('#campus-file').set_input_files(ZIP_FILE)
  # The first Vite optimization of the zip helper can reload the development page.
  try:await page.locator('#campus-preview').wait_for(state='visible',timeout=10000)
  except Exception:
   await page.locator('#campus-btn').click();await page.locator('#campus-file').set_input_files(ZIP_FILE);await page.locator('#campus-preview').wait_for(state='visible')
  await page.locator('#campus-enter').click();await page.wait_for_url(first_url);await page.wait_for_function('window.__game')
  assert await page.evaluate('__game.characterId')=='nana'
  # Same school ID with changed content must have a separate save namespace.
  changed=json.loads(Path(JSON_FILE).read_text(encoding='utf8'));changed['campus']['name']='示例学校 · 新版本'
  await page.locator('#campus-btn').click();await page.locator('#campus-file').set_input_files({'name':'campus.json','mimeType':'application/json','buffer':json.dumps(changed,ensure_ascii=False).encode()})
  await page.locator('#campus-preview').wait_for(state='visible');await page.locator('#campus-enter').click()
  await page.wait_for_function('window.__game?.campus.name==="示例学校 · 新版本"')
  assert page.url!=first_url
  assert await page.evaluate('__game.characterId')=='fox'
  await page.locator('#campus-btn').click();await page.get_by_role('button',name='进入示例学校',exact=True).click();await page.wait_for_url(first_url);await page.wait_for_function('window.__game')
  assert await page.evaluate('__game.characterId')=='nana'
  await page.locator('#campus-btn').click();await page.get_by_role('button',name='移除示例学校 · 新版本',exact=True).click()
  await page.wait_for_function('document.querySelectorAll(".campus-library-row").length===1')
  # A missing local file should still leave a working import/recovery entrypoint.
  await page.goto(ROOT+'?localCampus=missing',wait_until='networkidle')
  assert await page.locator('#error-message').is_visible()
  await page.locator('#campus-btn').click();assert await page.locator('#campus-dialog').is_visible()
  await page.locator('#campus-default').click();await page.wait_for_url(ROOT)
  mobile=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  mp=await mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)))
  await mp.goto(ROOT,wait_until='networkidle');await mp.wait_for_function('window.__game')
  await mp.screenshot(path='artifacts/campus-import-mobile-toolbar.png')
  await mp.locator('#campus-btn').tap();await mp.locator('#campus-file').set_input_files(JSON_FILE);await mp.locator('#campus-preview').wait_for(state='visible')
  await mp.screenshot(path='artifacts/campus-import-mobile.png')
  layout=await mp.evaluate('()=>{const r=document.querySelector("#campus-dialog").getBoundingClientRect();return{x:r.x,right:r.right,width:innerWidth,scroll:document.documentElement.scrollWidth}}')
  assert layout['x']>=0 and layout['right']<=layout['width'] and layout['scroll']==layout['width'],layout
  await mp.locator('#campus-enter').tap();await mp.wait_for_url('**/*localCampus=*');await mp.wait_for_function('window.__game?.campus.id==="example-school-v1"')
  assert not errors,errors
  result={'jsonImport':True,'zipImport':True,'duplicateReusesSave':True,'sameIdVersionsIsolated':True,'refreshRestoresNightAndCharacter':True,'returnToDefault':True,'invalidFileRejected':True,'recoveryEntry':True,'mobileImport':True,'layout':layout,'errors':errors}
  Path('artifacts/campus-import-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(result,ensure_ascii=False));await browser.close()

asyncio.run(main())
