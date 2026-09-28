import asyncio,json,math
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
  errors=[];reports=[]
  for width,height in [(390,844),(360,640),(844,390)]:
   context=await browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,device_scale_factor=1)
   page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto('http://127.0.0.1:5173/',wait_until='networkidle');await page.wait_for_function('window.__game')
   assert not await page.locator('#virtual-joystick').is_visible()
   await page.locator('#start-btn').tap();await page.wait_for_timeout(500)
   rect=await page.locator('#virtual-joystick').bounding_box();cx=rect['x']+rect['width']/2;cy=rect['y']+rect['height']/2
   assert rect['x']>=0 and rect['y']>=0 and rect['x']+rect['width']<=width and rect['y']+rect['height']<=height
   cdp=await context.new_cdp_session(page)
   async def touch(kind,x=None,y=None,other=None):
    points=[] if x is None else [{'x':x,'y':y,'id':1}]
    if other:points.append({'x':other[0],'y':other[1],'id':2})
    await cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
    # Chrome dispatches coalesced pointermove events on its next animation frame.
    await page.wait_for_timeout(80)
   async def zero():
    await page.wait_for_function('__game.input.joystick.pointer===null')
    move=await page.evaluate('__game.input.move');assert move['x']==0 and move['z']==0,move
   await page.evaluate('__game.navigate(-44,5)')
   await touch('touchStart',cx,cy);await page.wait_for_timeout(100)
   assert await page.evaluate('__game.route.length')==0
   await touch('touchMove',cx+2,cy-2)
   dead=await page.evaluate('__game.input.move');assert dead['x']==dead['z']==0
   await touch('touchMove',cx,cy-20)
   slow=await page.evaluate('__game.input.move');assert -.65<slow['z']<-.2 and abs(slow['x'])<.02,slow
   await touch('touchMove',cx+80,cy-80)
   diagonal=await page.evaluate('__game.input.move');assert abs(math.hypot(diagonal['x'],diagonal['z'])-1)<.01 and diagonal['x']>.65 and diagonal['z']<-.65,diagonal
   await page.screenshot(path=f'artifacts/joystick-active-{width}x{height}.png')
   # A second touch on the same pad cannot take control or end the first touch.
   await touch('touchStart',cx+80,cy-80,other=(cx-20,cy+10))
   after_second=await page.evaluate('__game.input.move');assert after_second==diagonal
   await touch('touchEnd',cx+80,cy-80);assert await page.evaluate('__game.input.joystick.pointer!==null')
   await touch('touchEnd');await zero()
   pos=await page.evaluate('__game.fox.group.position.toArray()');await page.wait_for_timeout(250);assert await page.evaluate('__game.fox.group.position.toArray()')==pos
   # Actual upward motion, without dragging the camera or clicking a path.
   angle=await page.evaluate('__game.angle');before=await page.evaluate('__game.fox.group.position.z')
   await touch('touchStart',cx,cy);await touch('touchMove',cx,cy-45);await page.wait_for_timeout(350);await touch('touchEnd');await zero()
   assert await page.evaluate('__game.fox.group.position.z')<before-.15
   assert await page.evaluate('__game.angle')==angle
   for interruption in ['cancel','capture','blur','modal','resize']:
    await touch('touchStart',cx,cy);await touch('touchMove',cx+40,cy)
    if interruption=='cancel':await touch('touchCancel')
    elif interruption=='capture':
     await page.evaluate('()=>{const j=__game.input.joystick;j.element.releasePointerCapture(j.pointer)}')
     await touch('touchMove',cx+41,cy)
    elif interruption=='blur':await page.evaluate('window.dispatchEvent(new Event("blur"))')
    elif interruption=='modal':await page.evaluate('document.querySelector("#help-dialog").showModal()')
    else:await page.evaluate('window.dispatchEvent(new Event("resize"))')
    await zero()
    if interruption!='cancel':await touch('touchEnd')
    if interruption=='modal':await page.evaluate('document.querySelector("#help-dialog").close()')
   await page.screenshot(path=f'artifacts/joystick-idle-{width}x{height}.png')
   # Keyboard input remains normalized and functional on a narrow screen.
   await page.keyboard.down('w');assert await page.evaluate('__game.input.move.z')==-1;await page.keyboard.up('w');await zero()
   reports.append({'viewport':[width,height],'deadZone':True,'slow':slow,'diagonal':diagonal,'releaseStops':True,'multiTouch':True,'interruptions':['cancel','capture','blur','modal','resize'],'cameraUnchanged':True})
   await context.close()
  assert not errors,errors
  Path('artifacts/joystick-verification.json').write_text(json.dumps({'reports':reports,'errors':errors},ensure_ascii=False,indent=2),encoding='utf8')
  print(json.dumps({'viewports':[r['viewport'] for r in reports],'passed':True,'errors':errors}));await browser.close()

asyncio.run(main())
