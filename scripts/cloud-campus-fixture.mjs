// Local test runtime only; never imported by the production Worker.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,sep,extname} from 'node:path';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const sessions={alice:'a'.repeat(64),device2:'b'.repeat(64),bob:'c'.repeat(64),expired:'d'.repeat(64)};
export async function fixture({serve=false}={}){
 const origin=serve?'https://127.0.0.1:8791':'https://3dschool.chipai.cc';
 const bundle=await build({entryPoints:['cloudflare/worker.js'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
 const root=resolve('dist');
 const mf=new Miniflare(convertV4MiniflareOptions({
  modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-28',
  ...(serve?{host:'127.0.0.1',port:8791,https:true}:{}),
  bindings:{ZHIHU_APP_ID:'850',ZHIHU_APP_KEY:'test-only',ZHIHU_REDIRECT_URI:origin+'/zhihu-callback'},
  d1Databases:['AUTH_DB'],outboundService:()=>new Response('Unexpected external request',{status:502}),
  serviceBindings:{ASSETS:async request=>{
   const path=resolve(root,'.'+decodeURIComponent(new URL(request.url).pathname));
   if(path!==root&&!path.startsWith(root+sep))return new Response('',{status:404});
   const types={'.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.html':'text/html'};
   try{return new Response(await readFile(path),{headers:{'Content-Type':types[extname(path)]||'application/octet-stream'}});}
   catch{return new Response(await readFile(resolve(root,'index.html')),{headers:{'Content-Type':'text/html'}});}
  }}
 }));
 const db=await mf.getD1Database('AUTH_DB');
 for(const file of ['0001_auth.sql','0002_cloud_campuses.sql']){
  for(const sql of (await readFile('cloudflare/migrations/'+file,'utf8')).split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 }
 for(const [name,token] of Object.entries(sessions))await db.prepare('INSERT INTO auth_sessions VALUES (?, ?, ?, ?)')
  .bind(hash(token),name==='bob'?'user-bob':'user-alice',name==='bob'?'另一位用户':'测试同学',Math.floor(Date.now()/1000)+(name==='expired'?-60:3600)).run();
 return {mf,db,origin};
}
if(process.argv.includes('--serve')){
 const {mf,origin}=await fixture({serve:true});await mf.ready;console.log('Campus test server ready: '+origin);
 process.on('SIGINT',async()=>{await mf.dispose();process.exit(0);});
}
