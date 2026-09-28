import {copyFile,writeFile} from 'node:fs/promises';
// Vite builds only the client; this file is never imported by the client bundle.
await copyFile(new URL('../cloudflare/worker.js',import.meta.url),new URL('../dist/_worker.js',import.meta.url));
await writeFile(new URL('../dist/_routes.json',import.meta.url),JSON.stringify({version:1,include:['/api/*','/zhihu-callback'],exclude:[]},null,2));
// Workers Static Assets must not publish the Pages server entry as a static file.
await writeFile(new URL('../dist/.assetsignore',import.meta.url),'_worker.js\n_routes.json\n');
console.log('Cloudflare Pages/Worker auth entry prepared. Secrets are runtime bindings only.');
