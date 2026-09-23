import { validateCampusPackage } from './campusPackage.js';

const MAX_JSON=2*1024*1024;
const decoder=new TextDecoder('utf-8',{fatal:true});
function database(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('3dschool-local-campuses',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('campuses',{keyPath:'key'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new Error('浏览器无法保存校园，请检查网站存储设置。'));
 });
}
async function transaction(mode,operation){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('campuses',mode),request=operation(tx.objectStore('campuses'));
  tx.oncomplete=()=>{db.close();resolve(request.result);};
  tx.onabort=tx.onerror=()=>{db.close();reject(new Error('校园保存或读取失败，浏览器存储空间可能不足。'));};
 });
}
export const listLocalCampuses=()=>transaction('readonly',store=>store.getAll());
export async function saveLocalCampus(payload){
 validateCampusPackage(payload);
 const saved=await listLocalCampuses(),serialized=JSON.stringify(payload);
 const same=saved.find(item=>JSON.stringify(item.payload)===serialized);
 if(same)return same.key;
 if(saved.length>=20)throw new Error('已保存 20 个校园，请先在校园列表中移除不需要的校园。');
 const key=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
 await transaction('readwrite',store=>store.put({key,payload,importedAt:Date.now()}));return key;
}
export const removeLocalCampus=key=>transaction('readwrite',store=>store.delete(key));
export async function loadLocalCampus(key){
 if(!/^[a-z0-9-]{1,60}$/.test(key))throw new Error('本地校园地址无效。');
 const record=await transaction('readonly',store=>store.get(key));
 if(!record)throw new Error('当前浏览器没有这份校园，请点击右上角“校园”重新导入。');
 return validateCampusPackage(record.payload);
}
export async function readCampusFile(file){
 if(!file)throw new Error('请选择校园文件。');
 let bytes;
 if(/\.zip$/i.test(file.name)){
  if(file.size>80*1024*1024)throw new Error('ZIP 超过 80 MB，请解压后选择 campus.json。');
  const {unzipSync}=await import('three/addons/libs/fflate.module.js');
  let count=0;
  const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{
   if(!/(^|\/)campus\.json$/.test(entry.name))return false;
   if(++count>1)throw new Error('ZIP 中有多个 campus.json，请解压后选择其中一个。');
   if(entry.originalSize>MAX_JSON)throw new Error('campus.json 超过 2 MB。');
   return true;
  }});
  bytes=Object.values(entries)[0];if(!bytes)throw new Error('ZIP 中没有 campus.json，请选择技能输出的校园模型包。');
 }else if(/\.json$/i.test(file.name)){
  if(file.size>MAX_JSON)throw new Error('校园 JSON 超过 2 MB。');
  bytes=new Uint8Array(await file.arrayBuffer());
 }else throw new Error('请选择 campus.json 或模型包 ZIP；GLB 仅包含静态模型。');
 if(bytes.byteLength>MAX_JSON)throw new Error('校园 JSON 超过 2 MB。');
 let payload;try{payload=JSON.parse(decoder.decode(bytes));}catch{throw new Error('校园 JSON 不是有效的 UTF-8 JSON 文件。');}
 validateCampusPackage(payload);return payload;
}
