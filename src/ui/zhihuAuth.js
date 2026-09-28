const messages = {
  invalid_state:'登录请求已过期或无法核对，请重新发起知乎登录。',
  invalid_code:'未收到有效授权码，请重新登录。',
  cancelled:'你已取消授权，可以继续以游客身份漫游。',
  provider_error:'暂时无法取得知乎用户信息，请稍后重新登录。',
  unavailable:'登录服务暂时不可用，仍可继续漫游。',
};

export function bindZhihuAuth() {
  const button=document.createElement('button');
  button.id='zhihu-account-btn';button.className='auth-tool';button.textContent='登录';button.setAttribute('aria-label','知乎账号');
  document.querySelector('.tools').append(button);
  const dialog=document.createElement('dialog');dialog.id='auth-dialog';dialog.className='paper-dialog auth-dialog';dialog.setAttribute('aria-labelledby','auth-title');
  dialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">YOUR CAMPUS JOURNEY</p><h2 id="auth-title">与你，一起逛校园</h2></div><button id="auth-close" aria-label="关闭账号">×</button></div>
    <div class="auth-profile" hidden><span class="auth-avatar" aria-hidden="true">知</span><div><strong id="auth-name"></strong><small>已通过知乎授权登录</small></div></div>
    <p class="dialog-description" id="auth-description">使用知乎账号登录，或直接以游客身份开启漫游。</p>
    <p id="auth-status" role="status" aria-live="polite"></p>
    <button class="primary auth-login" id="zhihu-login" disabled>使用知乎登录 <span>↗</span></button>
    <button class="secondary" id="zhihu-logout" hidden>退出登录</button>
    <p class="auth-note">登录仅用于识别你的知乎身份。校园进度保存在当前浏览器，暂不提供账号云同步。</p>`;
  document.getElementById('app').append(dialog);
  const $=id=>document.getElementById(id),status=$('auth-status');
  let state={configured:false,user:null},busy=false,expiryTimer;
  const notice=text=>{status.textContent=text;};
  const open=()=>{window.__game?.input.reset();if(!dialog.open)dialog.showModal();};
  const render=()=>{
    button.textContent=state.user?'账号':'登录';button.title=state.user?'知乎账号 · '+state.user.name:'使用知乎登录';
    dialog.querySelector('.auth-profile').hidden=!state.user;$('auth-name').textContent=state.user?.name||'';
    $('zhihu-login').hidden=!!state.user;$('zhihu-login').disabled=busy||!state.configured;
    $('zhihu-logout').hidden=!state.user;$('zhihu-logout').disabled=busy;
    $('auth-description').textContent=state.user?'欢迎回来，继续探索你喜欢的校园吧。':'使用知乎账号登录，或直接以游客身份开启漫游。';
  };
  async function api(path, options={}) {
    const response=await fetch('/api/auth/'+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...options});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('unavailable');
    return response.json();
  }
  async function refresh() {
    clearTimeout(expiryTimer);
    try {
      state=await api('session');render();
      notice(state.configured?'':'此站点尚未启用知乎登录，你可以继续以游客身份漫游。');
      if(state.user&&state.expiresAt)expiryTimer=setTimeout(()=>{state.user=null;render();notice('登录已过期，请重新授权。');},Math.max(0,state.expiresAt-Date.now()));
    } catch {state={configured:false,user:null};render();notice('登录服务暂时不可用，你可以继续漫游。');}
  }
  button.onclick=()=>{open();if(!busy)refresh();};
  $('auth-close').onclick=()=>dialog.close();
  $('zhihu-login').onclick=async()=>{
    if(busy||!state.configured)return;
    busy=true;render();notice('正在前往知乎授权…');window.__game?.save();
    try {
      const result=await api('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnTo:location.pathname+location.search})});
      const target=new URL(result.url);
      if(target.origin!=='https://openapi.zhihu.com'||target.pathname!=='/authorize')throw new Error('invalid redirect');
      location.assign(target.href);
    } catch {busy=false;render();notice('无法发起登录，请稍后重试。');}
  };
  $('zhihu-logout').onclick=async()=>{
    if(busy)return;busy=true;render();
    try {await api('logout',{method:'POST'});clearTimeout(expiryTimer);state.user=null;notice('已退出知乎账号。你的本机校园进度已保留。');}
    catch {notice('退出失败，请稍后重试。');}
    busy=false;render();
  };
  const url=new URL(location.href),outcome=url.searchParams.get('auth');
  if(outcome){url.searchParams.delete('auth');history.replaceState(null,'',url.pathname+url.search+url.hash);}
  refresh().then(()=>{if(outcome&&messages[outcome]){notice(messages[outcome]);open();}else if(outcome==='success'&&state.user){notice('知乎登录成功，欢迎回来。');}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)refresh();});
}
