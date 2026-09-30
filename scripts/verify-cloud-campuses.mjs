import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,sessions} from './cloud-campus-fixture.mjs';
import {campusRecipes} from '../src/data/campusGeometry.js';
import {recipes} from '../src/world/buildings.js';
import {returnPath} from '../cloudflare/worker.js';
assert.deepEqual([...campusRecipes].sort(),Object.keys(recipes).sort());
const payload=JSON.parse(readFileSync('public/campuses/example-school-v1/campus.json','utf8'));
const {mf,db,origin}=await fixture();
async function request(path='',{account='alice',method='GET',body,headers={}}={}){
 const response=await mf.dispatchFetch(origin+'/api/campuses'+path,{method,headers:{Origin:origin,
  ...(account?{Cookie:'__Host-school-session='+sessions[account],'X-Campus-Owner':account==='bob'?'user-bob':'user-alice'}:{}),
  ...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
 assert.equal(response.headers.get('cache-control'),'no-store');
 return {status:response.status,data:await response.json()};
}
try{
 assert.equal((await request('',{account:null})).status,401);
 assert.equal((await request('',{account:'expired'})).status,401);
 assert.equal((await request('',{method:'POST',body:payload,headers:{Origin:'https://foreign.invalid'}})).status,403);
 assert.equal((await request('',{method:'POST',body:payload,headers:{'X-Campus-Owner':'user-bob'}})).status,409);
 assert.equal((await request('',{method:'POST',body:'{oops'})).status,400);
 assert.equal((await request('',{method:'POST',body:{...payload,version:99}})).status,400);
 const saved=await request('',{method:'POST',body:payload});assert.equal(saved.status,201);const key=saved.data.key;
 assert.equal(returnPath('/?cloudCampus='+key,origin),'/?cloudCampus='+key);
 assert.equal((await request('',{account:'device2'})).data.campuses[0].key,key);
 assert.deepEqual((await request('/'+key,{account:'device2'})).data.payload,payload);
 assert.equal((await request('',{method:'POST',body:payload})).data.key,key);
 assert.deepEqual((await request('',{account:'bob'})).data.campuses,[]);
 assert.equal((await request('/'+key,{account:'bob'})).status,404);
 assert.equal((await request('/'+key,{account:'bob',method:'DELETE'})).status,404);
 const other=await request('',{account:'bob',method:'POST',body:payload});assert.notEqual(other.data.key,key);
 // Near the 2 MiB limit, including surrogate pairs across chunk boundaries.
 const large={...payload,notes:'校园🌲'.repeat(9000)+'a'.repeat(1900000)};
 assert.ok(Buffer.byteLength(JSON.stringify(large))<2*1024*1024);
 const largeSaved=await request('',{method:'POST',body:large});assert.equal(largeSaved.status,201);
 assert.deepEqual((await request('/'+largeSaved.data.key,{account:'device2'})).data.payload,large);
 const count=await db.prepare('SELECT COUNT(*) AS n FROM cloud_campus_chunks WHERE campus_key = ?').bind(largeSaved.data.key).first();assert.ok(count.n>25&&count.n<36);
 assert.equal((await request('',{method:'POST',body:{...payload,notes:'a'.repeat(2*1024*1024)}})).status,413);
 // Concurrent duplicate imports and last-slot quota contention.
 const duplicate={...payload,notes:'concurrent'};
 const results=await Promise.all([1,2].map(()=>request('',{method:'POST',body:duplicate})));
 assert.equal(results[0].data.key,results[1].data.key);
 for(let i=0;i<16;i++)assert.equal((await request('',{method:'POST',body:{...payload,notes:'version-'+i}})).status,201);
 assert.equal((await request()).data.campuses.length,19);
 const limit=await Promise.all([1,2].map(i=>request('',{method:'POST',body:{...payload,notes:'last-'+i}})));
 assert.deepEqual(limit.map(r=>r.status).sort(),[201,409]);assert.equal((await request()).data.campuses.length,20);
 assert.equal((await request('',{method:'POST',body:payload})).data.key,key);
 assert.equal((await request('/'+largeSaved.data.key,{method:'DELETE'})).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cloud_campus_chunks WHERE campus_key = ?').bind(largeSaved.data.key).first()).n,0);
 assert.equal((await request('/'+largeSaved.data.key,{account:'device2'})).status,404);
 assert.equal((await request('',{method:'POST',body:{...payload,notes:'quota-released'}})).status,201);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cloud_campus_chunks c LEFT JOIN cloud_campuses m ON m.campus_key=c.campus_key WHERE m.campus_key IS NULL').first()).n,0);
 await db.prepare('DROP TABLE cloud_campus_chunks').run();await db.prepare('DROP TABLE cloud_campuses').run();
 assert.equal((await request()).status,503);
 assert.equal((await mf.dispatchFetch(origin+'/api/auth/session',{headers:{Cookie:'__Host-school-session='+sessions.alice}})).status,200);
 console.log('Cloud campuses: actual workerd/D1 cross-device access, owner isolation, CSRF, validation, 2 MiB chunks, deduplication, concurrent quota, deletion and missing migration passed.');
}finally{await mf.dispose();}
