import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker, {returnPath} from '../cloudflare/worker.js';

const origin='https://museum.chipai.cc';
class D1 {
  constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(readFileSync(new URL('../cloudflare/migrations/0001_auth.sql',import.meta.url),'utf8'));}
  prepare(sql){const stmt=this.db.prepare(sql);let values=[];const query={bind(...v){values=v;return query;},async first(){return stmt.get(...values)||null;},async run(){return stmt.run(...values);}};return query;}
  async batch(statements){this.db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
function setup(){return {AUTH_DB:new D1(),ZHIHU_APP_ID:'851',ZHIHU_APP_KEY:'test-provider-key',ZHIHU_REDIRECT_URI:origin+'/zhihu-callback',ASSETS:{fetch:()=>new Response('static')}};}
function req(path,options={}){return new Request(origin+path,options);}
function post(path,body={},cookies=''){return req(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookies},body:JSON.stringify(body)});}
function cookies(response){return response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
async function begin(env,returnTo='/?campus=tongji-siping-v22'){
  const response=await worker.fetch(post('/api/auth/login',{returnTo}),env);
  assert.equal(response.status,200);const data=await response.json(),url=new URL(data.url);
  assert.equal(url.origin,'https://openapi.zhihu.com');assert.equal(url.searchParams.get('app_id'),'851');
  assert.equal(url.searchParams.get('redirect_uri'),env.ZHIHU_REDIRECT_URI);
  assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  return {state:url.searchParams.get('state'),cookie:cookies(response)};
}
const upstream=async(url,options)=>{
  assert.equal(options.redirect,'manual');
  if(url==='https://openapi.zhihu.com/access_token'){
    assert.equal(options.method,'POST');assert.equal(options.body.get('app_key'),'test-provider-key');assert.equal(options.body.get('code'),'valid-code');
    assert.equal(options.body.get('redirect_uri'),origin+'/zhihu-callback');
    return Response.json({code:20000,data:{access_token:'test-oauth-token',expires_in:3600}});
  }
  assert.equal(url,'https://openapi.zhihu.com/user');assert.equal(options.headers.Authorization,'Bearer test-oauth-token');
  return new Response('{"code":20000,"data":{"uid":969570047710216200,"fullname":"测试同学","email":"private@example.com","phone_no":"private-phone"}}');
};
function callback(flow,extra='authorization_code=valid-code'){return req('/zhihu-callback?state='+flow.state+'&'+extra,{headers:{Cookie:flow.cookie}});}

test('real SQL migration, complete code flow, private-field minimization and server-side logout',async t=>{
  t.mock.method(globalThis,'fetch',upstream);const env=setup(),flow=await begin(env);
  const response=await worker.fetch(callback(flow),env);assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/?campus=tongji-siping-v22&auth=success');
  const sessionCookie=cookies(response), session=await worker.fetch(req('/api/auth/session',{headers:{Cookie:sessionCookie}}),env);
  const data=await session.json();assert.deepEqual(data.user,{id:'969570047710216200',name:'测试同学'});
  const serialized=JSON.stringify(env.AUTH_DB.db.prepare('SELECT * FROM auth_sessions').all());
  for(const secret of ['test-oauth-token','test-provider-key','private@example.com','private-phone'])assert.ok(!serialized.includes(secret));
  assert.equal(session.headers.get('cache-control'),'no-store');
  assert.ok(!serialized.includes(sessionCookie.split('__Host-school-session=')[1]));
  const csrf=await worker.fetch(req('/api/auth/logout',{method:'POST',headers:{Cookie:sessionCookie,Origin:'https://evil.example'}}),env);assert.equal(csrf.status,403);
  assert.ok((await (await worker.fetch(req('/api/auth/session',{headers:{Cookie:sessionCookie}}),env)).json()).user);
  assert.equal((await worker.fetch(post('/api/auth/logout',{},sessionCookie),env)).status,200);
  assert.equal((await (await worker.fetch(req('/api/auth/session',{headers:{Cookie:sessionCookie}}),env)).json()).user,null);
});
test('state, browser binding, expiry, replay and concurrent callbacks',async t=>{
  const mocked=t.mock.method(globalThis,'fetch',upstream);const env=setup(),flow=await begin(env);
  for(const bad of [req('/zhihu-callback?authorization_code=valid-code',{headers:{Cookie:flow.cookie}}),callback({...flow,state:'a'.repeat(64)}),callback({...flow,cookie:''})]){
    assert.match((await worker.fetch(bad,env)).headers.get('location'),/invalid_state/);
  }
  assert.equal(mocked.mock.callCount(),0);
  const results=await Promise.all([worker.fetch(callback(flow),env),worker.fetch(callback(flow),env)]);
  assert.equal(results.filter(r=>r.headers.get('location').includes('success')).length,1);
  assert.equal(mocked.mock.callCount(),2);
  assert.match((await worker.fetch(callback(flow),env)).headers.get('location'),/invalid_state/);
  const expired=await begin(env);env.AUTH_DB.db.exec('UPDATE oauth_attempts SET expires_at=0');
  assert.match((await worker.fetch(callback(expired),env)).headers.get('location'),/invalid_state/);
});
test('expired sessions stop authenticating; both code parameter spellings work',async t=>{
  t.mock.method(globalThis,'fetch',upstream);const env=setup(),flow=await begin(env,'/?localCampus=saved_123');
  const result=await worker.fetch(callback(flow,'code=valid-code'),env);assert.match(result.headers.get('location'),/localCampus=saved_123&auth=success/);
  env.AUTH_DB.db.exec('UPDATE auth_sessions SET expires_at=0');
  const response=await worker.fetch(req('/api/auth/session',{headers:{Cookie:cookies(result)}}),env);
  assert.equal((await response.json()).user,null);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
});
test('provider rejection, denial and missing identity never establish a session',async t=>{
  const env=setup();let flow=await begin(env);
  assert.match((await worker.fetch(callback(flow,'error=access_denied'),env)).headers.get('location'),/cancelled/);
  for(const fail of [()=>new Response(null,{status:302,headers:{Location:'https://untrusted.example'}}),()=>Response.json({code:404,data:"User don't exist"}),()=>Response.json({data:{fullname:'no identity'}}),()=>{throw new Error('timeout with sensitive body');}]){
    const m=t.mock.method(globalThis,'fetch',fail);flow=await begin(env);
    const result=await worker.fetch(callback(flow),env);assert.match(result.headers.get('location'),/provider_error/);
    assert.equal(env.AUTH_DB.db.prepare('SELECT count(*) AS n FROM auth_sessions').get().n,0);m.mock.restore();
  }
  t.mock.method(globalThis,'fetch',async(url,opts)=>url.endsWith('access_token')?upstream(url,opts):Response.json({code:20000,data:{fullname:'no identity'}}));
  flow=await begin(env);assert.match((await worker.fetch(callback(flow),env)).headers.get('location'),/provider_error/);
});
test('configuration, same-origin mutations, allowlisted returns, methods and static fallback',async()=>{
  const env=setup();
  for(const path of ['https://evil.example','//evil.example','/\\evil.example','/zhihu-callback?code=stolen','/?auth=success'])assert.equal(returnPath(path,origin),'/');
  assert.equal((await worker.fetch(req('/api/auth/login'),env)).status,405);
  assert.equal((await worker.fetch(req('/api/auth/login',{method:'POST'}),env)).status,403);
  assert.equal((await worker.fetch(req('/api/missing'),env)).status,404);
  assert.equal(await (await worker.fetch(req('/campuses/test/campus.json'),env)).text(),'static');
  for(const missing of ['AUTH_DB','ZHIHU_APP_KEY','ZHIHU_APP_ID']){
    const broken={...env,[missing]:undefined};assert.equal((await (await worker.fetch(req('/api/auth/session'),broken)).json()).configured,false);
  }
  const preview=await worker.fetch(new Request('https://preview.pages.dev/api/auth/session'),env);assert.equal((await preview.json()).configured,false);
  assert.equal((await worker.fetch(post('/api/auth/login'),{...env,ZHIHU_REDIRECT_URI:'http://museum.chipai.cc/zhihu-callback'})).status,503);
});
