import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
// Vite builds only the client; this file is never imported by the client bundle.
await build({entryPoints:['cloudflare/worker.js'],outfile:'dist/_worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
await writeFile(new URL('../dist/_routes.json',import.meta.url),JSON.stringify({version:1,include:['/api/*','/zhihu-callback'],exclude:[]},null,2));
// Workers Static Assets must not publish the Pages server entry as a static file.
await writeFile(new URL('../dist/.assetsignore',import.meta.url),'_worker.js\n_routes.json\n');
console.log('Cloudflare Pages/Worker auth entry prepared. Secrets are runtime bindings only.');
