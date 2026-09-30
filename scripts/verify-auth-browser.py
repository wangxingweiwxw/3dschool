"""Account UI tests against local Cloudflare Pages, with mocked auth responses."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    out=Path('artifacts');out.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        page=await browser.new_page(viewport={'width':1440,'height':900});errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://127.0.0.1:8788/',wait_until='networkidle');await page.wait_for_function('window.__game')
        await page.locator('#zhihu-account-btn').click()
        assert await page.locator('#zhihu-login').is_disabled()
        assert '游客' in await page.locator('#auth-status').inner_text()
        await page.locator('#auth-close').click()
        state={'configured':True,'user':None}
        async def api(route):
            endpoint=route.request.url.rsplit('/',1)[-1]
            if endpoint=='logout':state['user']=None;result={'ok':True}
            elif endpoint=='login':
                assert 'campus=sjtu-xuhui-map-v2' in route.request.post_data_json['returnTo']
                result={'url':'https://openapi.zhihu.com/authorize?app_id=850&state=mock'}
            else:result=state
            await route.fulfill(json=result)
        await page.route('**/api/auth/*',api)
        await page.goto('http://127.0.0.1:8788/?campus=sjtu-xuhui-map-v2',wait_until='networkidle');await page.wait_for_function('window.__game')
        await page.locator('#zhihu-account-btn').click();await page.locator('#zhihu-login').wait_for(state='visible')
        await page.screenshot(path=str(out/'zhihu-login-desktop.png'))
        await page.route('https://openapi.zhihu.com/**',lambda r:r.fulfill(content_type='text/html',body='<p>Mock consent page</p>'))
        await page.locator('#zhihu-login').click();await page.wait_for_url('https://openapi.zhihu.com/**')
        state['user']={'id':'test-user','name':'测试同学 <img src=x onerror=alert(1)>'}
        await page.goto('http://127.0.0.1:8788/?campus=sjtu-xuhui-map-v2&auth=success',wait_until='networkidle');await page.wait_for_function('window.__game')
        assert 'auth=' not in page.url
        await page.locator('#zhihu-account-btn').click()
        assert '<img' in await page.locator('#auth-name').inner_text()
        assert await page.locator('#auth-name img').count()==0
        before=await page.evaluate('__game.saveKey')
        await page.locator('#zhihu-logout').click();await page.locator('#zhihu-login').wait_for(state='visible')
        assert await page.evaluate('__game.saveKey')==before
        await page.locator('#auth-close').click()
        await page.goto('http://127.0.0.1:8788/?auth=invalid_state',wait_until='networkidle')
        assert await page.locator('#auth-dialog').is_visible()
        assert '核对' in await page.locator('#auth-status').inner_text()
        mobile=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mp=await mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)));await mp.route('**/api/auth/*',api)
        await mp.goto('http://127.0.0.1:8788/',wait_until='networkidle');await mp.wait_for_function('window.__game')
        await mp.locator('#zhihu-account-btn').tap();await mp.screenshot(path=str(out/'zhihu-login-mobile.png'))
        layout=await mp.evaluate('()=>{const d=document.querySelector("#auth-dialog").getBoundingClientRect(),b=document.querySelector("#zhihu-account-btn").getBoundingClientRect();return{left:d.left,right:d.right,button:b.right,width:innerWidth,scroll:document.documentElement.scrollWidth}}')
        assert layout['left']>=0 and layout['right']<=layout['width'] and layout['button']<=layout['width'] and layout['scroll']==layout['width'],layout
        await mp.locator('#auth-close').tap();await mp.locator('#start-btn').tap();assert await mp.locator('#virtual-joystick').is_visible()
        await mp.screenshot(path=str(out/'zhihu-login-mobile-game.png'))
        assert not errors,errors
        (out/'zhihu-auth-ui-verification.json').write_text(json.dumps({'mockOnly':True,'desktop':True,'mobile':layout,'guestFallback':True,'campusReturn':True,'logout':True,'escapedName':True,'errors':errors},ensure_ascii=False,indent=2),encoding='utf8')
        print('Desktop/mobile login, guest fallback, redirect, logout, escaped name and gameplay UI passed.')
        await browser.close()

asyncio.run(main())
