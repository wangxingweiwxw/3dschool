"""Run against node scripts/cloud-campus-fixture.mjs --serve after npm run build."""
import asyncio,json,io,zipfile
from pathlib import Path
from playwright.async_api import async_playwright

ROOT='https://127.0.0.1:8791/'
FILE=Path('public/campuses/example-school-v1/campus.json')

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
  errors=[]
  async def context(token=None,mobile=False):
   ctx=await browser.new_context(ignore_https_errors=True,viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile)
   if token:await ctx.add_cookies([{'name':'__Host-school-session','value':token*64,'url':ROOT,'secure':True,'httpOnly':True,'sameSite':'Lax'}])
   page=await ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto(ROOT);await page.wait_for_function('window.__game')
   return ctx,page
  async def open_selector(page):
   if not await page.locator('#campus-dialog').is_visible():await page.locator('#campus-btn').click()
   await page.wait_for_function('!document.querySelector("#campus-storage-note").textContent.includes("正在")')
  async def prepare(page,data=None):
   await open_selector(page)
   await page.locator('#campus-file').set_input_files(data or str(FILE))
   await page.locator('#campus-preview').wait_for(state='visible')
  async def local_count(page):
   return await page.evaluate('''() => new Promise((resolve,reject)=>{const r=indexedDB.open('3dschool-local-campuses',1);r.onupgradeneeded=()=>r.result.createObjectStore('campuses',{keyPath:'key'});r.onsuccess=()=>{const db=r.result;const q=db.transaction('campuses').objectStore('campuses').count();q.onsuccess=()=>{resolve(q.result);db.close()};q.onerror=reject};r.onerror=reject})''')
  guest,gp=await context();posts=[]
  gp.on('request',lambda r:posts.append(r.url) if r.method=='POST' and '/api/campuses' in r.url else None)
  await prepare(gp);assert '游客' in await gp.locator('#campus-storage-note').inner_text()
  await gp.locator('#campus-enter').click();await gp.wait_for_url('**/*localCampus=*');await gp.wait_for_function('window.__game?.campus.id==="example-school-v1"')
  assert await local_count(gp)==1 and not posts
  guest_url=gp.url
  # Login on this device exposes an explicit migration control; no automatic upload.
  await guest.add_cookies([{'name':'__Host-school-session','value':'a'*64,'url':ROOT,'secure':True,'httpOnly':True,'sameSite':'Lax'}])
  await gp.reload();await gp.wait_for_function('window.__game');await open_selector(gp)
  await gp.wait_for_function('document.querySelector("#campus-cloud-status").textContent.includes("还没有")')
  assert not posts
  await gp.get_by_role('button',name='同步示例学校到账号',exact=True).click()
  await gp.get_by_role('button',name='进入云端校园示例学校',exact=True).wait_for()
  assert await local_count(gp)==1
  await gp.get_by_role('button',name='进入云端校园示例学校',exact=True).click()
  await gp.wait_for_url('**/*cloudCampus=*');await gp.wait_for_function('window.__game?.campus.id==="example-school-v1"');cloud_url=gp.url
  await gp.evaluate('__game.selectCharacter("nana");__game.save()')
  device,dp=await context('b',True);assert await local_count(dp)==0
  await open_selector(dp);await dp.get_by_role('button',name='进入云端校园示例学校',exact=True).wait_for()
  await dp.locator('#campus-cloud-library').scroll_into_view_if_needed()
  await dp.screenshot(path='artifacts/cloud-campus-mobile.png')
  layout=await dp.evaluate('()=>{let e=document.querySelector("#campus-dialog"),r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,client:e.clientWidth,scroll:e.scrollWidth}}')
  assert layout['left']>=0 and layout['right']<=layout['width'] and layout['scroll']<=layout['client']+1,layout
  await dp.get_by_role('button',name='进入云端校园示例学校',exact=True).click();await dp.wait_for_url(cloud_url);await dp.wait_for_function('window.__game?.campus.id==="example-school-v1"')
  assert await dp.evaluate('__game.characterId')=='fox' # Progress is local to each device.
  await dp.locator('#start-btn').click()
  assert await local_count(dp)==0
  other,op=await context('c');await open_selector(op);await op.wait_for_function('document.querySelector("#campus-cloud-status").textContent.includes("还没有")')
  assert await op.locator('#campus-cloud-library button').count()==0
  response=await op.request.get(cloud_url.replace('/?cloudCampus=','/api/campuses/'));assert response.status==404
  # Logged-in ZIP import creates a second cloud map without IndexedDB backup.
  changed=json.loads(FILE.read_text('utf8'));changed['campus']['name']='第二座校园 · ZIP'
  archive=io.BytesIO()
  with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('model/campus.json',json.dumps(changed,ensure_ascii=False))
  await prepare(dp,{'name':'school.zip','mimeType':'application/zip','buffer':archive.getvalue()})
  await dp.locator('#campus-enter').click();await dp.wait_for_function('window.__game?.campus.name==="第二座校园 · ZIP"')
  assert 'cloudCampus=' in dp.url and await local_count(dp)==0
  # Failed cloud storage keeps the pending import and does not silently save locally.
  await prepare(dp)
  async def fail(route):
   if route.request.method=='POST':await route.fulfill(status=503,content_type='application/json',body='{"error":"unavailable"}')
   else:await route.continue_()
  await dp.route('**/api/campuses',fail);old=dp.url
  await dp.locator('#campus-enter').click();await dp.wait_for_function('document.querySelector("#campus-import-status").textContent.includes("导入失败")')
  assert dp.url==old and await local_count(dp)==0 and await dp.locator('#campus-preview').is_visible()
  await dp.unroute('**/api/campuses',fail)
  await gp.reload();await gp.wait_for_function('window.__game');assert await gp.evaluate('__game.characterId')=='nana'
  await open_selector(gp);await gp.get_by_role('button',name='进入云端校园第二座校园 · ZIP',exact=True).wait_for()
  await gp.screenshot(path='artifacts/cloud-campus-desktop.png')
  gp.once('dialog',lambda d:d.accept())
  await gp.get_by_role('button',name='删除云端校园第二座校园 · ZIP',exact=True).click()
  await gp.get_by_role('button',name='进入云端校园第二座校园 · ZIP',exact=True).wait_for(state='detached')
  # Logout clears cloud list access, leaves original guest copy usable.
  await gp.locator('#campus-close').click();await gp.locator('#zhihu-account-btn').click();await gp.locator('#zhihu-logout').click()
  await gp.wait_for_function('document.querySelector("#zhihu-account-btn").textContent==="登录"');await gp.locator('#auth-close').click()
  await open_selector(gp);await gp.wait_for_function('document.querySelector("#campus-cloud-status").textContent.includes("登录知乎")')
  assert await gp.locator('#campus-cloud-library button').count()==0
  await gp.get_by_role('button',name='进入示例学校',exact=True).click();await gp.wait_for_url(guest_url);await gp.wait_for_function('window.__game')
  assert not errors,errors
  result={'guestLocalOnly':True,'explicitLocalSync':True,'twoIsolatedDevices':True,'otherAccountIsolated':True,'loggedInZipImport':True,'cloudFailureKeepsPending':True,'progressRemainsLocal':True,'delete':True,'logout':True,'mobile':layout,'errors':errors}
  Path('artifacts/cloud-campus-browser-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(result,ensure_ascii=False))
  await browser.close()

asyncio.run(main())
