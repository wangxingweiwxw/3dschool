// Exercises the actual workerd runtime and D1, with no network calls to Zhihu.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const origin='https://3dschool.chipai.cc';
let exchanges=0;
const mf=new Miniflare(convertV4MiniflareOptions({
  modules:true,scriptPath:'cloudflare/worker.js',compatibilityDate:'2026-09-28',
  bindings:{ZHIHU_APP_ID:'850',ZHIHU_APP_KEY:'fake-key',ZHIHU_REDIRECT_URI:origin+'/zhihu-callback'},
  d1Databases:['AUTH_DB'],
  outboundService:async request=>{
    if(request.url==='https://openapi.zhihu.com/access_token'){
      exchanges++;const body=await request.formData();assert.equal(body.get('app_key'),'fake-key');assert.equal(body.get('code'),'test-code');
      return Response.json({code:20000,data:{access_token:'fake-token',expires_in:3600}});
    }
    assert.equal(request.url,'https://openapi.zhihu.com/user');assert.equal(request.headers.get('authorization'),'Bearer fake-token');
    return new Response('{"uid":969570047710216200,"fullname":"Cloudflare 测试用户"}');
  },
  serviceBindings:{ASSETS:()=>new Response('asset')},
}));
try {
  const db=await mf.getD1Database('AUTH_DB');
  for(const sql of readFileSync('cloudflare/migrations/0001_auth.sql','utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
  const login=await mf.dispatchFetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"returnTo":"/?campus=ecnu-zhongshan-2001-v1"}'});
  assert.equal(login.status,200);const state=new URL((await login.json()).url).searchParams.get('state');
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const callback=origin+'/zhihu-callback?authorization_code=test-code&state='+state;
  const responses=await Promise.all([0,1].map(()=>mf.dispatchFetch(callback,{headers:{Cookie:cookie},redirect:'manual'})));
  const success=responses.find(r=>r.headers.get('location')?.includes('auth=success'));
  assert.ok(success,JSON.stringify({locations:responses.map(r=>r.headers.get('location')),exchanges}));assert.equal(responses.filter(r=>r.headers.get('location')?.includes('invalid_state')).length,1);assert.equal(exchanges,1);
  const sessionCookie=success.headers.getSetCookie().find(c=>c.startsWith('__Host-school-session=')).split(';')[0];
  const session=await mf.dispatchFetch(origin+'/api/auth/session',{headers:{Cookie:sessionCookie}});
  assert.deepEqual((await session.json()).user,{id:'969570047710216200',name:'Cloudflare 测试用户'});
  assert.equal((await mf.dispatchFetch(origin+'/api/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:sessionCookie}})).status,200);
  assert.equal((await (await mf.dispatchFetch(origin+'/api/auth/session',{headers:{Cookie:sessionCookie}})).json()).user,null);
  console.log('Cloudflare workerd + D1: OAuth exchange, atomic state, lossless uid, session and logout passed.');
} finally {await mf.dispose();}
