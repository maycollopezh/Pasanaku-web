import test from 'node:test';
import assert from 'node:assert/strict';
const memory = () => { const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)}; };
globalThis.localStorage=memory();globalThis.sessionStorage=memory();
const {configure,login,loadCloud,pushCloud,cloudInfo}=await import('./cloud.js');
let responses=[],calls=[];
globalThis.fetch=async(url,options)=>{calls.push({url,...options});const next=responses.shift();if(!next)throw Error('Unexpected request');return {ok:next.ok!==false,json:async()=>next.data};};
const token=(expires_in=3600)=>({access_token:'test-access',refresh_token:'test-refresh',expires_in,user:{email:'admin@example.test'}});
function reset(){configure('https://example-project.supabase.co','sb_publishable_test');responses=[];calls=[];}
test('rechaza claves secretas y conexiones ajenas a Supabase',()=>{assert.throws(()=>configure('http://example.com','sb_publishable_test'));assert.throws(()=>configure('https://example.supabase.co','sb_secret_test'));});
test('consulta previa obligatoria y versión de guardado correcta',async()=>{
 reset();responses.push({data:token()});await login('admin@example.test','test-only');
 await assert.rejects(pushCloud({schema:2}),/Primero consulta/);assert.equal(calls.length,1);
 responses.push({data:[{version:7,payload:{schema:2,groups:[],active:null}}]});await loadCloud();
 responses.push({data:8});await pushCloud({schema:2,groups:[],active:null});
 assert.equal(JSON.parse(calls.at(-1).body).p_expected,7);assert.equal(cloudInfo().version,8);
});
test('un conflicto de versión no adelanta la versión local',async()=>{
 reset();responses.push({data:token()});await login('admin@example.test','test-only');
 responses.push({data:[]});assert.equal(await loadCloud(),null);
 responses.push({ok:false,data:{message:'Otro dispositivo guardó cambios.'}});
 await assert.rejects(pushCloud({schema:2,groups:[],active:null}),/Otro dispositivo/);assert.equal(cloudInfo().version,0);
});
test('renueva sesión vencida antes de leer datos',async()=>{
 reset();responses.push({data:token(-10)});await login('admin@example.test','test-only');
 responses.push({data:{...token(),access_token:'test-renewed'}},{data:[]});await loadCloud();
 assert.ok(calls[1].url.endsWith('grant_type=refresh_token'));assert.equal(calls[2].headers.Authorization,'Bearer test-renewed');
});
