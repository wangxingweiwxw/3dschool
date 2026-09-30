import {validateCampusPackage} from './campusPackage.js';
const errors={login_required:'请先登录知乎账号，再访问云端校园。',not_found:'这份校园不存在或不属于当前知乎账号。',campus_limit:'账号已保存 20 个校园，请先删除不需要的校园。',too_large:'校园 JSON 超过 2 MB。',invalid_campus:'校园文件校验失败，请检查文件格式。',origin:'请求来源校验失败，请刷新后重试。',account_changed:'登录账号已变化，请刷新校园列表后重试。',unavailable:'云端校园暂时不可用，请稍后重试。保存结果请以账号校园列表为准。'};
async function call(path,options={}){
 let response;try{response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000),...options});}catch{throw new Error(errors.unavailable);}
 let data;try{data=await response.json();}catch{throw new Error(errors.unavailable);}
 if(!response.ok)throw new Error(errors[data.error]||errors.unavailable);
 return data;
}
export async function campusIdentity(){
 let response;try{response=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});}catch{throw new Error('无法确认登录状态，请联网后重试。');}
 // A plain static deployment has no account backend, and retains local import.
 if(response.status===404||(response.ok&&!response.headers.get('content-type')?.includes('application/json')))return null;
 if(!response.ok)throw new Error('无法确认登录状态，请稍后重试。');
 return (await response.json()).user||null;
}
export const listCloudCampuses=async()=> (await call('campuses')).campuses;
export async function saveCloudCampus(payload,owner){
 validateCampusPackage(payload);
 return (await call('campuses',{method:'POST',headers:{'Content-Type':'application/json','X-Campus-Owner':owner},body:JSON.stringify(payload)})).key;
}
export const removeCloudCampus=(key,owner)=>call('campuses/'+key,{method:'DELETE',headers:{'X-Campus-Owner':owner}});
export async function loadCloudCampus(key){
 if(!/^[a-f0-9]{64}$/.test(key))throw new Error('云端校园地址无效。');
 const user=await campusIdentity();if(!user)throw new Error(errors.login_required);
 const result=await call('campuses/'+key);
 return {campus:validateCampusPackage(result.payload),owner:user.id};
}
