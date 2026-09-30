import {validateCampusPackage} from '../src/data/campusPackage.js';
const MAX_BYTES=2*1024*1024, CHUNK=60000;
const encoder=new TextEncoder();
async function readBody(request) {
 if(Number(request.headers.get('content-length'))>MAX_BYTES)throw new RangeError();
 const reader=request.body?.getReader();if(!reader)throw new TypeError();
 const parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw new RangeError();}parts.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
 return new TextDecoder('utf8',{fatal:true}).decode(bytes);
}
export async function handleCampuses(request,env,{user,config,json,digest,sameOrigin}) {
 const path=new URL(request.url).pathname, match=path.match(/^\/api\/campuses\/([a-f0-9]{64})$/), key=match?.[1];
 if(path!=='/api/campuses'&&!match)return json({error:'not_found'},404);
 if(!user)return json({error:'login_required'},401);
 const allowed=key?['GET','DELETE']:['GET','POST'];
 if(!allowed.includes(request.method))return json({error:'method'},405);
 if(request.method!=='GET'&&!sameOrigin(request,config))return json({error:'origin'},403);
 const db=env.AUTH_DB,owner=user.user_id;
 if(request.method!=='GET'&&request.headers.get('X-Campus-Owner')!==owner)return json({error:'account_changed'},409);
 if(request.method==='GET'&&!key){
  const {results}=await db.prepare('SELECT campus_key AS key, name, byte_size AS bytes, created_at AS createdAt FROM cloud_campuses WHERE owner_id = ? ORDER BY created_at DESC, campus_key LIMIT 20').bind(owner).all();
  return json({campuses:results});
 }
 if(key){
  if(request.method==='DELETE'){
   const row=await db.prepare('DELETE FROM cloud_campuses WHERE campus_key = ? AND owner_id = ? RETURNING campus_key').bind(key,owner).first();
   return row?json({ok:true}):json({error:'not_found'},404);
  }
  const {results}=await db.prepare('SELECT c.content, c.part, m.content_hash FROM cloud_campus_chunks c JOIN cloud_campuses m ON m.campus_key = c.campus_key WHERE m.campus_key = ? AND m.owner_id = ? ORDER BY c.part').bind(key,owner).all();
  if(!results.length)return json({error:'not_found'},404);
  const text=results.map(r=>r.content).join('');
  if(await digest(text)!==results[0].content_hash)return json({error:'unavailable'},503);
  return json({payload:JSON.parse(text)});
 }
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'content_type'},415);
 let payload,text;
 try{payload=JSON.parse(await readBody(request));validateCampusPackage(payload);text=JSON.stringify(payload);if(encoder.encode(text).byteLength>MAX_BYTES)throw new RangeError();}
 catch(e){return json({error:e instanceof RangeError?'too_large':'invalid_campus'},e instanceof RangeError?413:400);}
 const hash=await digest(text),campusKey=await digest(owner+'\0'+hash),bytes=encoder.encode(text).byteLength;
 const existing=await db.prepare('SELECT campus_key FROM cloud_campuses WHERE owner_id = ? AND content_hash = ?').bind(owner,hash).first();
 if(existing)return json({key:existing.campus_key,existing:true});
 const statements=[db.prepare('INSERT OR IGNORE INTO cloud_campuses (campus_key, owner_id, content_hash, name, byte_size, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM cloud_campuses WHERE owner_id = ?) < 20')
  .bind(campusKey,owner,hash,payload.campus.name,bytes,Date.now(),owner)];
 // Split on code points so D1 never receives half a surrogate pair.
 const chunks=[];for(let start=0;start<text.length;){let end=Math.min(start+CHUNK,text.length);const last=text.charCodeAt(end-1);if(last>=0xd800&&last<=0xdbff)end--;chunks.push(text.slice(start,end));start=end;}
 chunks.forEach((content,part)=>statements.push(db.prepare('INSERT OR IGNORE INTO cloud_campus_chunks (campus_key, part, content) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM cloud_campuses WHERE campus_key = ? AND owner_id = ?)').bind(campusKey,part,content,campusKey,owner)));
 // Atomic batch: no partial maps, no quota race, and duplicate imports reuse the same key.
 await db.batch(statements);
 const saved=await db.prepare('SELECT campus_key FROM cloud_campuses WHERE campus_key = ? AND owner_id = ?').bind(campusKey,owner).first();
 return saved?json({key:campusKey,existing:false},201):json({error:'campus_limit'},409);
}
