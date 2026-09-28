"""Render the actual game models into local UI portraits (requires Vite on 5173)."""
import asyncio
import base64
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True,
            args=['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        page = await browser.new_page()
        await page.goto('http://127.0.0.1:5173/', wait_until='networkidle')
        portraits = await page.evaluate('''async () => {
          const THREE=await import('/node_modules/.vite/deps/three.js');
          const {ArcticFox}=await import('/src/player/ArcticFox.js');
          const {XiaoNa}=await import('/src/player/XiaoNa.js');
          const {XiaoMing}=await import('/src/player/XiaoMing.js');
          const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
          renderer.setSize(360,360);renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);
          renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
          const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff5df,0x829373,2.3));
          const sun=new THREE.DirectionalLight(0xfff0d5,3);sun.position.set(-3,7,5);scene.add(sun);
          const camera=new THREE.OrthographicCamera(-1.6,1.6,1.6,-1.6,.1,30);
          camera.position.set(-3,2.9,6);camera.lookAt(0,1.35,0);
          const portraits={};
          for(const [id,actor] of [['fox',new ArcticFox()],['nana',new XiaoNa()],['ming',new XiaoMing()]]){
            actor.group.position.y=id==='fox'?.25:0;scene.add(actor.group);renderer.render(scene,camera);
            portraits[id]=renderer.domElement.toDataURL('image/png');scene.remove(actor.group);
          }
          renderer.dispose();return portraits;
        }''')
        target = Path('public/characters')
        target.mkdir(parents=True, exist_ok=True)
        for name, url in portraits.items():
            (target / f'{name}.png').write_bytes(base64.b64decode(url.split(',')[1]))
        await browser.close()
        print('Rendered fox.png, nana.png and ming.png from game geometry.')


asyncio.run(main())
