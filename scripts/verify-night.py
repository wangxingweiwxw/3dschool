"""Verify the three time presets, night rendering, saves and mobile controls."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True,
            args=['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
        page = await context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        await page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
        await page.wait_for_function('window.__game?.environment')
        await page.locator('#welcome-characters [data-character=ming]').click()
        await page.get_by_role('button',name='出发，去逛逛').click()
        await page.wait_for_timeout(600)
        await page.evaluate('''() => {
          const g=__game;cancelAnimationFrame(g.frame);g.hud.hideSpeech();document.getElementById('toast').hidden=true;
          window.pose=(x,z,zoom=30)=>{g.fox.setPose(x,z,0);g.zoom=zoom;g.updateCamera(1,true);g.updateDecor(0);};
          window.settle=()=>{for(let i=0;i<180;i++){g.environment.update(1/60,g.cameraFocus,g.fox.group.position);g.world.occlusion.update(1/60,g.camera,g.fox.group.position,true);}g.renderer.render(g.scene,g.camera);g.labelRenderer.render(g.scene,g.camera);};
          window.state=()=>({time:g.timeOfDay,background:g.scene.background.getHex(),fog:g.scene.fog.color.getHex(),night:g.environment.night,lamps:g.environment.lamps,lights:g.environment.localLights.map(l=>l.intensity),emission:[...g.environment.emissiveMaterials].map(m=>({kind:m.userData.nightEmission,intensity:m.emissiveIntensity})),water:g.world.decorations.water.map(w=>w.material.uniforms.night.value),calls:g.renderer.info.render.calls,mode:g.environment.mode});
          pose(-45,21);settle();
        }''')
        day=await page.evaluate('state()')
        await page.screenshot(path='artifacts/time-day.png')
        await page.locator('#time-btn').click()
        assert await page.evaluate('__game.timeOfDay')=='evening'
        await page.evaluate('settle()')
        evening=await page.evaluate('state()')
        await page.screenshot(path='artifacts/time-evening.png')
        await page.locator('#time-btn').click()
        assert await page.evaluate('__game.timeOfDay')=='night'
        await page.evaluate('settle()')
        night=await page.evaluate('state()')
        await page.screenshot(path='artifacts/time-night.png')
        assert night['night']==1 and night['lamps']==1 and night['background']==night['fog'],night
        assert any(v>0 for v in night['lights']) and len(night['emission'])>3,night
        assert all(m['intensity']>0 for m in night['emission']) and all(v==1 for v in night['water']),night
        assert night['calls']<=day['calls']+2,(night['calls'],day['calls'])
        await page.locator('#time-btn').click()
        await page.evaluate('settle()')
        restored=await page.evaluate('state()')
        assert restored['time']=='day' and restored['night']==0 and restored['lamps']==0,restored
        assert all(m['intensity']==0 for m in restored['emission']) and not any(restored['lights']),restored
        assert restored['background']==day['background'],(restored,day)
        await page.evaluate("__game.setTimeOfDay('night',{instant:true});settle()")
        for landmark in ['xianghui','guanghua','lakeside']:
            await page.evaluate("id=>{const m=__game.campus.landmarks.find(m=>m.id===id);pose(m.approach.x,m.approach.z);settle();}",landmark)
            await page.screenshot(path=f'artifacts/night-{landmark}.png')
        await page.evaluate('pose(-5,38);settle()')
        assert await page.evaluate("__game.world.occlusion.lastHits.includes('lidasan')")
        await page.screenshot(path='artifacts/night-occlusion.png')
        async with page.expect_download() as info:
            await page.get_by_role('button',name='保存校园照片',exact=True).click()
        await (await info.value).save_as('artifacts/night-postcard.png')
        stable=await page.evaluate('''() => {
          const g=__game,before=g.scene.children.length;
          for(let i=0;i<9;i++){g.toggleTime();settle();}
          const stable=g.scene.children.length===before&&g.environment.localLights.length===4;
          pose(-45,21);g.save();return stable;
        }''')
        assert stable
        await page.reload(wait_until='networkidle')
        persisted=await page.evaluate('({time:__game.timeOfDay,id:__game.characterId,night:__game.environment.night})')
        assert persisted=={'time':'night','id':'ming','night':1},persisted
        await page.get_by_role('button',name='出发，去逛逛').click()
        z=await page.evaluate('__game.fox.group.position.z')
        await page.keyboard.down('w');await page.wait_for_timeout(700);await page.keyboard.up('w')
        assert await page.evaluate('__game.fox.group.position.z')<z-.5
        await page.keyboard.press('m');assert await page.locator('#map-dialog').is_visible()
        await page.get_by_role('button',name='⌖ 相辉堂',exact=True).click()
        assert await page.evaluate('__game.route.length')>0
        mobile=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mp=await mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)))
        await mp.goto('http://127.0.0.1:5173/',wait_until='networkidle')
        await mp.get_by_role('button',name='出发，去逛逛').tap()
        await mp.locator('#time-btn').tap();await mp.locator('#time-btn').tap()
        await mp.wait_for_timeout(1900)
        assert await mp.evaluate('__game.timeOfDay')=='night'
        await mp.screenshot(path='artifacts/night-mobile.png')
        box=await mp.locator('#time-btn').bounding_box()
        assert box and 0<=box['x'] and box['x']+box['width']<=390,box
        assert await mp.evaluate('document.documentElement.scrollWidth')==390
        # A separate device context gives mobile Chrome the correct layout viewport.
        small=await browser.new_context(viewport={'width':320,'height':640},is_mobile=True,has_touch=True)
        sp=await small.new_page();sp.on('pageerror',lambda e:errors.append(str(e)))
        await sp.goto('http://127.0.0.1:5173/',wait_until='networkidle')
        await sp.get_by_role('button',name='出发，去逛逛').tap()
        await sp.locator('#time-btn').tap();await sp.locator('#time-btn').tap()
        await sp.wait_for_timeout(1900)
        await sp.screenshot(path='artifacts/night-mobile-small.png')
        assert await sp.evaluate('document.documentElement.scrollWidth')==320
        small_button=await sp.locator('#time-btn').bounding_box()
        assert small_button['x']>=0 and small_button['x']+small_button['width']<=320
        result={'day':day,'evening':evening,'night':night,'restored':restored,'persisted':persisted,'stableLights':stable,'errors':errors}
        Path('artifacts/night-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        assert not errors,errors
        print(json.dumps(result,ensure_ascii=False))
        await browser.close()


asyncio.run(main())
