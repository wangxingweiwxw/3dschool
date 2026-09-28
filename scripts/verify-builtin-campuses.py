"""Verify the deployable build with isolated Chrome and a temporary static server."""
import asyncio
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
CAMPUS_IDS = ['sjtu-xuhui-map-v2', 'tongji-siping-v22', 'ecnu-zhongshan-2001-v1']


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.startswith('/school/'):
            self.path = self.path[len('/school'):]
        super().do_GET()


async def ready(page, campus=None):
    await page.wait_for_function('window.__game', timeout=60000)
    assert not await page.locator('#error-message').is_visible()
    if campus:
        assert await page.evaluate('__game.campus.id') == campus
    else:
        assert await page.evaluate('!__game.customCampus')


async def choose(page, campus):
    await page.locator('#campus-btn').click()
    await page.locator(f'.campus-card[data-campus="{campus or "fudan"}"]').click()
    await page.wait_for_url(lambda url: f'campus={campus}' in url if campus else '?' not in url)
    await ready(page, campus)


async def main(base):
    OUT.mkdir(exist_ok=True)
    errors, results = [], {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            headless=True,
            args=['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(base, wait_until='networkidle')
        await ready(page)
        await page.evaluate('__game.selectCharacter("ming");__game.setTimeOfDay("evening",{instant:true});__game.save()')
        original = await page.evaluate('localStorage.getItem(__game.saveKey)')
        await page.locator('#campus-btn').click()
        assert await page.locator('.campus-card').count() == 4
        assert await page.locator('.campus-card.is-current').get_attribute('data-campus') == 'fudan'
        await page.wait_for_function('Array.from(document.querySelectorAll(".campus-card img")).every(i=>i.complete&&i.naturalWidth>0)')
        await page.screenshot(path=str(OUT / 'builtin-campuses-desktop.png'))
        # Failed downloads remain recoverable and cannot switch to a broken page.
        failure_url = '**/campuses/sjtu-xuhui-map-v2/campus.json'
        await page.route(failure_url, lambda route: route.fulfill(status=503, body='Unavailable'))
        await page.locator('[data-campus="sjtu-xuhui-map-v2"]').click()
        await page.wait_for_function('document.querySelector("#campus-switch-status").textContent.includes("加载失败")')
        assert await page.locator('#campus-close').is_enabled()
        assert await page.evaluate('!__game.customCampus')
        await page.unroute(failure_url)
        await page.locator('#campus-close').click()

        for i, campus in enumerate(CAMPUS_IDS):
            await choose(page, campus)
            assert 'localCampus' not in page.url
            print('Loaded ' + campus, flush=True)
            journey = await page.evaluate('''()=>{
              const g=__game;cancelAnimationFrame(g.frame);g.resetWorld(true);g.hud.start();const visits=[];
              for(const m of g.campus.landmarks){
                const accepted=g.navigate(m.approach.x,m.approach.z);let ticks=0;
                while(g.route.length&&ticks++<16000)g.updatePlayer(1/30);
                visits.push({id:m.id,accepted,remaining:g.route.length,checked:!m.taskId||g.done.has(m.taskId)});
              }
              for(const m of g.world.memories){if(m.taken)continue;g.navigate(m.x,m.z);let ticks=0;
                while(g.route.length&&ticks++<16000)g.updatePlayer(1/30);}
              document.querySelectorAll('dialog[open]').forEach(d=>d.close());g.save();g.tick();
              return {visits,completed:g.completed,tasks:g.done.size,totalTasks:g.campus.tasks.length,
                memories:g.world.memories.filter(m=>m.taken).length,totalMemories:g.world.memories.length,saveKey:g.saveKey};
            }''')
            results[campus] = journey
            (OUT / 'builtin-campuses-verification.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
            assert journey['completed'] and journey['memories'] == journey['totalMemories'], journey
            assert all(v['remaining'] == 0 and v['checked'] for v in journey['visits']), journey
            character, time = [('nana', 'night'), ('fox', 'day'), ('ming', 'evening')][i]
            await page.evaluate('([c,t])=>{__game.selectCharacter(c);__game.setTimeOfDay(t,{instant:true});__game.save()}', [character, time])
            await page.reload(wait_until='networkidle')
            await ready(page, campus)
            assert await page.evaluate('[__game.characterId,__game.timeOfDay,__game.completed]') == [character, time, True]
            assert await page.evaluate("localStorage.getItem('fudan-garden-adventure-v2')") == original
            print('Journey and save passed: ' + campus, flush=True)
        assert len({results[c]['saveKey'] for c in CAMPUS_IDS}) == 3

        # A direct visit always opens Fudan, even after choosing another campus.
        await page.goto(base, wait_until='networkidle')
        await ready(page)
        assert await page.evaluate('[__game.characterId,__game.timeOfDay]') == ['ming', 'evening']
        # Preserve personal ZIP import and ensure switching clears its query.
        await page.locator('#campus-btn').click()
        await page.locator('#campus-file').set_input_files(str(ROOT / 'artifacts/skill-template-packages/example-school-v1.zip'))
        await page.locator('#campus-preview').wait_for(state='visible')
        await page.locator('#campus-enter').click()
        await page.wait_for_url('**/*localCampus=*')
        await ready(page, 'example-school-v1')
        await choose(page, CAMPUS_IDS[0])
        assert await page.evaluate('__game.characterId') == 'nana'
        await choose(page, None)
        assert await page.evaluate('__game.characterId') == 'ming'

        # Relative assets and JSON must also work below a server subdirectory.
        await page.goto(base + 'school/', wait_until='networkidle')
        await ready(page)
        await choose(page, CAMPUS_IDS[1])
        assert '/school/?campus=' in page.url

        await context.close()
        mobile = await browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        mp = await mobile.new_page()
        mp.on('pageerror', lambda error: errors.append(str(error)))
        await mp.goto(base, wait_until='networkidle')
        await ready(mp)
        await mp.locator('#campus-btn').tap()
        await mp.wait_for_function('Array.from(document.querySelectorAll(".campus-card img")).every(i=>i.complete&&i.naturalWidth>0)')
        layout = await mp.evaluate('''()=>{const d=document.querySelector('#campus-dialog'),r=d.getBoundingClientRect();
          return {left:r.left,right:r.right,width:innerWidth,scroll:d.scrollWidth,client:d.clientWidth,
            cards:[...document.querySelectorAll('.campus-card')].map(c=>{const b=c.getBoundingClientRect();return {width:b.width,height:b.height}})};}''')
        assert layout['left'] >= 0 and layout['right'] <= layout['width'] and layout['scroll'] == layout['client'], layout
        assert all(c['width'] >= 130 and c['height'] >= 44 for c in layout['cards']), layout
        await mp.screenshot(path=str(OUT / 'builtin-campuses-mobile.png'))
        await mp.locator('[data-campus="ecnu-zhongshan-2001-v1"]').tap()
        await mp.wait_for_url('**/*campus=ecnu-zhongshan-2001-v1')
        await ready(mp, CAMPUS_IDS[2])
        await mp.locator('#start-btn').tap()
        assert await mp.locator('#virtual-joystick').is_visible()
        await mp.screenshot(path=str(OUT / 'builtin-campus-mobile-play.png'))
        assert not errors, errors
        results.update(defaultFudan=True, independentSaves=True, localZipImport=True,
                       failedDownloadRecovery=True, subdirectoryDeployment=True, mobile=layout, errors=errors)
        (OUT / 'builtin-campuses-verification.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
        print('All built-in campus integration checks passed.', flush=True)
        await browser.close()


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        asyncio.run(main(f'http://127.0.0.1:{server.server_port}/'))
    finally:
        server.shutdown()
        server.server_close()
