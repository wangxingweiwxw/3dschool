"""Regression checks for per-object occlusion and rendered before/after captures."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            headless=True,
            args=['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
        )
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto('http://127.0.0.1:5173/', wait_until='networkidle')
        await page.wait_for_function('window.__game?.world.occlusion')
        assert await page.evaluate('__game.world.occlusion.entries.every(e=>e.opacity===1)')
        await page.get_by_role('button', name='出发，去逛逛').click()
        await page.wait_for_timeout(650)
        await page.evaluate('''() => {
          const g=__game;cancelAnimationFrame(g.frame);g.input.keys.clear();g.hud.hideSpeech();
          window.pose=(x,z,angle=.28)=>{g.fox.setPose(x,z,Math.PI);g.angle=angle;g.zoom=25;g.updateCamera(1,true);g.updateDecor(0);};
          window.settle=(frames=60)=>{for(let i=0;i<frames;i++)g.world.occlusion.update(1/60,g.camera,g.fox.group.position,true);};
          window.paint=()=>{g.renderer.render(g.scene,g.camera);g.labelRenderer.render(g.scene,g.camera);};
          pose(-5,38);g.world.occlusion.reset();g.world.occlusion.enabled=false;paint();
        }''')
        await page.screenshot(path='artifacts/occlusion-before.png')
        before_calls = await page.evaluate('__game.renderer.info.render.calls')
        await page.evaluate('__game.world.occlusion.enabled=true;settle();paint()')
        await page.screenshot(path='artifacts/occlusion-after.png')
        initial = await page.evaluate('''() => {
          const g=__game;const materials=[];g.fox.group.traverse(o=>{if(o.isMesh)materials.push(o.material.opacity);});
          return {...g.world.occlusion.getDebugState(),foxOpaque:materials.every(v=>v===1),calls:g.renderer.info.render.calls,blocked:g.blocked(-5,48),msaaSamples:g.world.occlusion.msaaSamples.value};
        }''')
        assert any(e['id'] == 'lidasan' and e['opacity'] < .2 for e in initial['faded']), initial
        assert initial['foxOpaque'] and initial['blocked'], initial
        assert initial['calls'] == before_calls, (before_calls, initial['calls'])
        result = await page.evaluate('''() => {
          const g=__game,f=g.world.occlusion;
          // Same viewpoint with the building behind the camera-to-player segment.
          pose(-5,58);settle(120);paint();const front=f.getDebugState();
          pose(-5,38);settle();const behind=f.getDebugState();
          g.angle=Math.PI;g.updateCamera(1,true);settle(120);const rotated=f.getDebugState();
          pose(-65,-31);settle();paint();const hall=f.getDebugState();
          pose(10,-79);settle();const tower=f.getDebugState();
          // Fade-out must be progressive rather than a single-frame toggle.
          f.reset();pose(-5,38);const opacity=[];
          for(let i=0;i<30;i++){settle(1);opacity.push(f.entries.find(e=>e.id==='lidasan').opacity);}
          // Find a walkable foliage-only obstruction in the actual generated campus.
          let foliage=null;
          for(const tree of g.world.treeSpots){
            const x=tree.x-Math.sin(.28)*3,z=tree.z-Math.cos(.28)*3;
            if(g.blocked(x,z))continue;f.reset();pose(x,z);settle();
            const state=f.getDebugState();
            if(state.faded.length&&state.faded.every(e=>e.kind==='foliage')){foliage={x,z,...state};break;}
          }
          const start=performance.now();for(let i=0;i<120;i++)settle(1);const cpuMsPerUpdate=(performance.now()-start)/120;
          const opaqueSlotZero=f.values[0];f.reset();const reset=f.entries.every(e=>e.opacity===1);
          return{front,behind,rotated,hall,tower,opacity,foliage,cpuMsPerUpdate,opaqueSlotZero,reset,registered:f.entries.length};
        }''')
        assert not any(e['id'] == 'lidasan' for e in result['front']['faded']), result['front']
        assert not any(e['id'] == 'lidasan' for e in result['rotated']['faded']), result['rotated']
        assert any(e['id'] == 'xianghui-hall' for e in result['hall']['faded']), result['hall']
        assert any(e['id'] == 'guanghua-towers' for e in result['tower']['faded']), result['tower']
        opacity = result['opacity']
        assert .2 < opacity[0] < 1 and opacity[-1] == .18 and all(b <= a for a, b in zip(opacity, opacity[1:])), opacity
        assert result['foliage'] and result['reset'] and result['opaqueSlotZero'] == 1, result
        await page.evaluate('pose(-65,-31);settle();paint()')
        await page.screenshot(path='artifacts/occlusion-xianghui.png')
        await page.evaluate('pose(10,-79);settle();paint()')
        await page.screenshot(path='artifacts/occlusion-guanghua.png')
        await page.evaluate('pose(-5,38);settle();__game.world.occlusion.msaaSamples.value=1;paint()')
        await page.screenshot(path='artifacts/occlusion-no-msaa.png')
        await page.evaluate('(samples)=>{__game.world.occlusion.msaaSamples.value=samples}', initial['msaaSamples'])
        await page.evaluate('([x,z])=>{pose(x,z);settle();paint();}', [result['foliage']['x'], result['foliage']['z']])
        await page.screenshot(path='artifacts/occlusion-foliage.png')
        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.evaluate('pose(-5,38);settle();paint()')
        await page.screenshot(path='artifacts/occlusion-mobile.png')
        assert await page.evaluate("__game.world.occlusion.lastHits.includes('lidasan')")
        result.update(initial=initial, errors=errors, beforeCalls=before_calls)
        Path('artifacts/occlusion-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        assert not errors, errors
        print(json.dumps(result, ensure_ascii=False))
        await browser.close()


asyncio.run(main())
