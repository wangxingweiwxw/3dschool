"""Exercise avatar choice, movement, switching, saves and mobile layout."""
import asyncio
import argparse
import json
from pathlib import Path
from playwright.async_api import async_playwright

SAVE_KEY = 'fudan-garden-adventure-v2'
parser = argparse.ArgumentParser()
parser.add_argument('--character', choices=['nana', 'ming'], default='nana')
character = parser.parse_args().character
name = {'nana': '小娜', 'ming': '小鸣'}[character]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True,
            args=['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto('http://127.0.0.1:5173/', wait_until='networkidle')
        await page.wait_for_function('window.__game?.world')
        await page.locator('#welcome-characters').get_by_role('button', name=f'选择{name}', exact=True).click()
        assert await page.evaluate('__game.characterId') == character
        assert await page.locator(f'#welcome-characters [data-character={character}]').get_attribute('aria-pressed') == 'true'
        assert await page.locator('#welcome-name').inner_text() == name
        assert await page.locator('#welcome-characters .character-card').count() == 3
        await page.wait_for_timeout(250)
        await page.screenshot(path=f'artifacts/characters-{character}-welcome.png')
        await page.get_by_role('button', name='出发，去逛逛').click()
        await page.keyboard.down('w')
        await page.wait_for_timeout(800)
        moving = await page.evaluate('({z:__game.fox.group.position.z,legs:__game.fox.legs.map(l=>l.rotation.x),phase:__game.fox.bob})')
        await page.keyboard.up('w')
        assert moving['z'] < 20 and any(abs(v) > .01 for v in moving['legs']), moving
        await page.wait_for_timeout(600)
        await page.screenshot(path=f'artifacts/characters-{character}-nana-playing.png')
        before = await page.evaluate('({x:__game.fox.group.position.x,z:__game.fox.group.position.z,done:[...__game.done]})')
        await page.get_by_role('button', name='切换漫游角色', exact=True).click()
        assert await page.locator('#character-dialog').is_visible()
        await page.locator('#dialog-characters').get_by_role('button', name='选择阿雪', exact=True).click()
        assert await page.evaluate('__game.characterId') == 'fox'
        assert await page.evaluate('({x:__game.fox.group.position.x,z:__game.fox.group.position.z,done:[...__game.done]})') == before
        await page.locator('#dialog-characters').get_by_role('button', name=f'选择{name}', exact=True).click()
        await page.screenshot(path=f'artifacts/characters-{character}-switch.png')
        await page.get_by_role('button', name='选好了，继续漫游').click()
        await page.reload(wait_until='networkidle')
        restored = await page.evaluate('({id:__game.characterId,x:__game.fox.group.position.x,z:__game.fox.group.position.z,done:[...__game.done],label:__game.playerLabel.element.textContent})')
        assert restored['id'] == character and restored['label'] == name, restored
        assert restored['x'] == before['x'] and restored['z'] == before['z'] and restored['done'] == before['done'], restored
        await page.get_by_role('button', name='出发，去逛逛').click()
        await page.wait_for_timeout(550)
        journey = await page.evaluate('''(character) => {
          const g=__game;cancelAnimationFrame(g.frame);g.resetWorld(true);g.hud.start();
          const positions=[],angles=[];let penetration=false;
          for(const mark of g.campus.landmarks){
            const ok=g.navigate(mark.approach.x,mark.approach.z);let ticks=0;
            while(g.route.length&&ticks++<9000){g.updatePlayer(1/30);if(g.blocked(g.fox.group.position.x,g.fox.group.position.z))penetration=true;}
            positions.push({id:mark.id,ok,remaining:g.route.length});
          }
          for(const memory of g.world.memories){if(memory.taken)continue;g.navigate(memory.x,memory.z);let ticks=0;while(g.route.length&&ticks++<9000)g.updatePlayer(1/30);}
          document.querySelectorAll('dialog[open]').forEach(d=>d.close());
          const complete=g.completed,done=g.done.size,memories=g.world.memories.filter(m=>m.taken).length;
          const player=g.fox;player.update(.05,{x:0,z:1},false);const walk=player.bob;player.update(.05,{x:0,z:1},true);const runAdvance=player.bob-walk;
          for(let i=0;i<90;i++)player.update(1/60,{x:0,z:0},false);const idleLegs=player.legs.map(l=>l.rotation.x);
          const activeBefore=g.scene.children.length;for(let i=0;i<42;i++)g.selectCharacter(['fox','nana','ming'][i%3]);g.selectCharacter(character);
          const sceneStable=g.scene.children.length===activeBefore,activeModels=Object.values(g.characters).filter(c=>c.group.parent===g.scene).length;
          g.fox.setPose(-5,38,Math.PI);g.zoom=23;g.angle=.28;g.updateCamera(1,true);g.updateDecor(0);g.hud.hideSpeech();
          for(let i=0;i<60;i++)g.world.occlusion.update(1/60,g.camera,g.fox.group.position,true);
          g.renderer.render(g.scene,g.camera);g.labelRenderer.render(g.scene,g.camera);
          return{positions,penetration,complete,done,memories,runAdvance,idleLegs,sceneStable,activeModels,occlusion:g.world.occlusion.getDebugState(),id:g.characterId};
        }''', character)
        assert journey['id'] == character and journey['complete'] and journey['done'] == 13 and journey['memories'] == 12, journey
        assert all(r['ok'] and r['remaining'] == 0 for r in journey['positions']) and not journey['penetration'], journey
        assert journey['sceneStable'] and journey['activeModels'] == 1, journey
        assert all(abs(v) < .001 for v in journey['idleLegs']) and abs(journey['runAdvance']-.75) < 1e-6, journey
        assert 'lidasan' in journey['occlusion']['hits'], journey
        await page.screenshot(path=f'artifacts/characters-{character}-nana-occlusion.png')
        # Old saves have no characterId: keep their completed journey and default to fox.
        await page.evaluate('(key)=>{__game.save();const old=JSON.parse(localStorage.getItem(key));delete old.characterId;localStorage.setItem(key,JSON.stringify(old));__game.save=()=>{}}', SAVE_KEY)
        await page.reload(wait_until='networkidle')
        legacy = await page.evaluate('({id:__game.characterId,done:__game.done.size})')
        assert legacy == {'id': 'fox', 'done': 13}, legacy
        mobile = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        mp = await mobile.new_page()
        mp.on('pageerror', lambda e: errors.append(str(e)))
        await mp.goto('http://127.0.0.1:5173/', wait_until='networkidle')
        await mp.locator('#welcome-characters').get_by_role('button', name=f'选择{name}', exact=True).tap()
        await mp.wait_for_timeout(250)
        await mp.screenshot(path=f'artifacts/characters-{character}-mobile-welcome.png')
        await mp.get_by_role('button', name='出发，去逛逛').tap()
        await mp.wait_for_timeout(500)
        await mp.get_by_role('button', name='切换漫游角色', exact=True).tap()
        await mp.wait_for_timeout(250)
        for card in await mp.locator('#dialog-characters .character-card').all():
            rect = await card.bounding_box()
            assert 0 <= rect['x'] and rect['x'] + rect['width'] <= 390, rect
        await mp.screenshot(path=f'artifacts/characters-{character}-mobile-switch.png')
        bounds = await mp.locator('#character-dialog').bounding_box()
        assert 0 <= bounds['x'] and bounds['x'] + bounds['width'] <= 390 and bounds['height'] <= 844, bounds
        assert await mp.evaluate('document.documentElement.scrollWidth') == 390
        await mp.get_by_role('button', name='选好了，继续漫游').tap()
        button = await mp.get_by_role('button', name='前进', exact=True).bounding_box()
        session = await mobile.new_cdp_session(mp)
        await session.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':button['x']+button['width']/2,'y':button['y']+button['height']/2}]})
        await mp.wait_for_timeout(650)
        await session.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        assert await mp.evaluate('__game.fox.group.position.z') < 20
        result = {'moving':moving,'restored':restored,'journey':journey,'legacy':legacy,'mobileDialog':bounds,'errors':errors}
        Path(f'artifacts/characters-{character}-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        assert not errors, errors
        print(json.dumps(result,ensure_ascii=False))
        await browser.close()


asyncio.run(main())
