// Shared by Pages advanced mode and Workers Static Assets. No Node.js APIs.
const AUTHORIZE = 'https://openapi.zhihu.com/authorize';
const TOKEN = 'https://openapi.zhihu.com/access_token';
const PROFILE = 'https://openapi.zhihu.com/user';
const SESSION = '__Host-school-session';
const FLOW = '__Host-school-oauth';
const encoder = new TextEncoder();

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
}
async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), n => n.toString(16).padStart(2, '0')).join('');
}
function cookie(request, name) {
  const matches = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(name + '='));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : '';
}
function setCookie(name, value, age) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}
function headers(extra = {}) {
  return new Headers({'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff', ...extra});
}
function json(value, status = 200, cookies = []) {
  const h = headers({'Content-Type':'application/json; charset=utf-8'});
  cookies.forEach(c => h.append('Set-Cookie', c));
  return new Response(JSON.stringify(value), {status, headers:h});
}
function redirect(path, cookies = []) {
  const h = headers({Location:path});
  cookies.forEach(c => h.append('Set-Cookie', c));
  return new Response(null, {status:303, headers:h});
}
function settings(env, request) {
  try {
    const callback = new URL(env.ZHIHU_REDIRECT_URI);
    if (!/^\d+$/.test(env.ZHIHU_APP_ID || '') || !env.ZHIHU_APP_KEY || !env.AUTH_DB?.prepare ||
        callback.protocol !== 'https:' || callback.pathname !== '/zhihu-callback' || callback.search || callback.hash ||
        callback.username || callback.password || callback.origin !== new URL(request.url).origin) return null;
    return {callback:callback.href, origin:callback.origin};
  } catch { return null; }
}
// Only a game homepage and its campus selector can be a post-login destination.
export function returnPath(value, origin) {
  if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  const u = new URL(value, origin);
  if (u.origin !== origin || !['/', '/index.html'].includes(u.pathname)) return '/';
  const out = new URL('/', origin);
  for (const key of ['campus', 'localCampus']) {
    const v = u.searchParams.get(key);
    if (v && /^[a-zA-Z0-9_-]{1,160}$/.test(v)) out.searchParams.set(key, v);
  }
  return out.pathname + out.search;
}
function outcome(path, code) {
  const u = new URL(path, 'https://return.invalid');
  u.searchParams.set('auth', code);
  return u.pathname + u.search;
}
function validId(value) { return /^[a-f0-9]{64}$/.test(value || ''); }
function sameOrigin(request, config) {
  return request.headers.get('origin') === config.origin && !['cross-site','none'].includes(request.headers.get('sec-fetch-site'));
}
async function readUpstream(url, options) {
  // workerd supports manual/follow; reject redirects without forwarding credentials.
  const response = await fetch(url, {...options, redirect:'manual', signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('provider');
  // Reviver source preserves int64 uid before any conversion back to a string.
  const text = await response.text();
  if (text.length > 128000) throw new Error('provider');
  const value = JSON.parse(text, (_key, v, context) => typeof v === 'number' && Number.isInteger(v) && !Number.isSafeInteger(v) ? (context?.source ?? null) : v);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('provider');
  if (value.code != null && ![0,200,20000].includes(Number(value.code))) throw new Error('provider');
  return value;
}
export function profileIdentity(payload) {
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const user = data.user && typeof data.user === 'object' ? data.user : data;
  let id = typeof user.hash_id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(user.hash_id) ? user.hash_id : null;
  if (!id && ((typeof user.uid === 'string' && /^\d{1,30}$/.test(user.uid)) || (Number.isSafeInteger(user.uid) && user.uid > 0))) id = String(user.uid);
  if (!id) throw new Error('profile');
  return {id, name:typeof user.fullname === 'string' && user.fullname.trim() ? user.fullname.trim().slice(0,80) : '知乎用户'};
}
async function cleanExpired(db, now) {
  await db.batch([
    db.prepare('DELETE FROM oauth_attempts WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now),
  ]);
}
async function begin(request, env, config) {
  if (!sameOrigin(request, config)) return json({error:'origin'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'content_type'},415);
  const body = await request.text();
  if (body.length > 2048) return json({error:'request'},413);
  let data; try {data = JSON.parse(body);} catch {return json({error:'request'},400);}
  const path = returnPath(data?.returnTo, config.origin), state = randomId(), browser = randomId(), now = Math.floor(Date.now()/1000);
  await cleanExpired(env.AUTH_DB, now);
  const previous = cookie(request, FLOW);
  if (validId(previous)) await env.AUTH_DB.prepare('DELETE FROM oauth_attempts WHERE browser_hash = ?').bind(await digest(previous)).run();
  await env.AUTH_DB.prepare('INSERT INTO oauth_attempts (state_hash, browser_hash, return_to, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await digest(state), await digest(browser), path, now+600).run();
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({app_id:env.ZHIHU_APP_ID, redirect_uri:config.callback, response_type:'code', state}).toString();
  return json({url:url.href},200,[setCookie(FLOW,browser,600)]);
}
async function callback(request, env, config) {
  const url = new URL(request.url), state = url.searchParams.get('state'), browser = cookie(request,FLOW);
  const clearedFlow = setCookie(FLOW,'',0);
  if (!validId(state) || !validId(browser) || url.searchParams.getAll('state').length !== 1) return redirect(outcome('/','invalid_state'),[clearedFlow]);
  const now = Math.floor(Date.now()/1000);
  // DELETE RETURNING is atomic: one authorization request can create at most one session.
  const attempt = await env.AUTH_DB.prepare('DELETE FROM oauth_attempts WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING return_to')
    .bind(await digest(state), await digest(browser), now).first();
  if (!attempt) return redirect(outcome('/','invalid_state'),[clearedFlow]);
  const path = returnPath(attempt.return_to,config.origin);
  if (url.searchParams.has('error')) return redirect(outcome(path,'cancelled'),[clearedFlow]);
  const code = url.searchParams.get('authorization_code') || url.searchParams.get('code');
  if (!code || code.length > 4096 || url.searchParams.getAll('authorization_code').length > 1 || url.searchParams.getAll('code').length > 1) return redirect(outcome(path,'invalid_code'),[clearedFlow]);
  let profile, ttl;
  try {
    const tokenResponse = await readUpstream(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({
      app_id:env.ZHIHU_APP_ID,app_key:env.ZHIHU_APP_KEY,grant_type:'authorization_code',redirect_uri:config.callback,code,
    })});
    const token = tokenResponse.data && typeof tokenResponse.data === 'object' ? tokenResponse.data : tokenResponse;
    if (typeof token.access_token !== 'string' || !token.access_token || token.access_token.length > 8192 || !Number.isFinite(Number(token.expires_in)) || Number(token.expires_in) <= 0) throw new Error('token');
    ttl = Math.min(3600,Math.floor(Number(token.expires_in)));
    profile = profileIdentity(await readUpstream(PROFILE,{headers:{Authorization:'Bearer '+token.access_token,Accept:'application/json'}}));
    // This application only logs in. The provider token and private contact fields are discarded.
  } catch {return redirect(outcome(path,'provider_error'),[clearedFlow]);}
  const session = randomId(), old = cookie(request,SESSION);
  const operations = [];
  if (validId(old)) operations.push(env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE session_hash = ?').bind(await digest(old)));
  operations.push(env.AUTH_DB.prepare('INSERT INTO auth_sessions (session_hash, user_id, user_name, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await digest(session),profile.id,profile.name,now+ttl));
  await env.AUTH_DB.batch(operations);
  return redirect(outcome(path,'success'),[clearedFlow,setCookie(SESSION,session,ttl)]);
}
async function current(request, env) {
  const id = cookie(request,SESSION);
  if (!validId(id)) return json({configured:true,user:null});
  const hash = await digest(id), now = Math.floor(Date.now()/1000);
  const row = await env.AUTH_DB.prepare('SELECT user_id, user_name, expires_at FROM auth_sessions WHERE session_hash = ? AND expires_at > ?').bind(hash,now).first();
  if (!row) {
    await env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE session_hash = ?').bind(hash).run();
    return json({configured:true,user:null},200,[setCookie(SESSION,'',0)]);
  }
  return json({configured:true,user:{id:row.user_id,name:row.user_name},expiresAt:row.expires_at*1000});
}
async function logout(request, env, config) {
  if (!sameOrigin(request,config)) return json({error:'origin'},403);
  const id = cookie(request,SESSION), flow = cookie(request,FLOW), ops = [];
  if (validId(id)) ops.push(env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE session_hash = ?').bind(await digest(id)));
  if (validId(flow)) ops.push(env.AUTH_DB.prepare('DELETE FROM oauth_attempts WHERE browser_hash = ?').bind(await digest(flow)));
  if (ops.length) await env.AUTH_DB.batch(ops);
  return json({ok:true},200,[setCookie(SESSION,'',0),setCookie(FLOW,'',0)]);
}

export default {
  async fetch(request,env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/') && path !== '/zhihu-callback') {
      if (['/_worker.js','/_routes.json','/.dev.vars','/.env'].includes(path)) return new Response('Not found',{status:404});
      return env.ASSETS.fetch(request);
    }
    const methods = {'/api/auth/session':'GET','/api/auth/login':'POST','/api/auth/logout':'POST','/zhihu-callback':'GET'};
    if (!methods[path]) return json({error:'not_found'},404);
    if (request.method !== methods[path]) return new Response(null,{status:405,headers:headers({Allow:methods[path]})});
    const config = settings(env,request);
    if (!config) return path === '/api/auth/session' ? json({configured:false,user:null}) : path === '/zhihu-callback' ? redirect('/?auth=unavailable',[setCookie(FLOW,'',0)]) : json({error:'unavailable'},503);
    try {
      if (path === '/api/auth/login') return await begin(request,env,config);
      if (path === '/zhihu-callback') return await callback(request,env,config);
      if (path === '/api/auth/logout') return await logout(request,env,config);
      return await current(request,env);
    } catch {
      // Never log requests, codes, upstream responses, cookies, or provider credentials.
      return path === '/zhihu-callback' ? redirect('/?auth=unavailable',[setCookie(FLOW,'',0)]) : json({error:'unavailable'},503);
    }
  },
};
