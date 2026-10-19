import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoSync,sameData} from './auto-sync.js';
const data=(...ids)=>({schema:2,active:ids[0]||null,groups:ids.map(id=>({id}))});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(t,options={}) {
 const state={remote:{data:data(),version:1},scope:'project|account-a',online:true,writes:[],stored:null,applied:[],...options};
 const cloud={scope:()=>state.scope,read:async()=>structuredClone(state.remote),write:async(payload,expected)=>{assert.equal(expected,state.remote.version);state.writes.push(structuredClone(payload));state.remote={data:structuredClone(payload),version:expected+1};return state.remote.version;}};
 const sync=createAutoSync({initial:options.initial||{data:data(),owner:state.scope,version:1,dirty:false},store:value=>{if(state.failStorage)throw Error('No hay espacio');state.stored=value;},cloud,validate:value=>{assert.ok(Array.isArray(value.groups));},onData:value=>state.applied.push(value),online:()=>state.online,delay:600000,retryDelay:600000,canReplace:()=>state.canReplace!==false});
 t.after(()=>sync.dispose());return {sync,state,cloud};
}
test('carga la copia remota en un dispositivo nuevo sin sobrescribirla',async t=>{
 const {sync,state}=setup(t,{initial:{data:data(),owner:null,version:null,dirty:false},remote:{data:data('grupo'),version:9}});
 await sync.reconcile();assert.deepEqual(sync.snapshot().data,data('grupo'));assert.equal(sync.snapshot().version,9);assert.equal(state.writes.length,0);assert.equal(state.applied.length,1);
});
test('guarda un cambio contra su versión reconocida y no repite guardados sin cambios',async t=>{
 const {sync,state}=setup(t);sync.commit(data('grupo'));await sync.reconcile();await sync.reconcile();
 assert.equal(state.writes.length,1);assert.equal(sync.snapshot().version,2);assert.equal(sync.status().kind,'saved');
});
test('los cambios durante un envío no se marcan prematuramente como guardados',async t=>{
 const {sync,state,cloud}=setup(t);const gate=deferred(),sending=deferred();const write=cloud.write;
 cloud.write=async(payload,version)=>{sending.resolve();await gate.promise;return write(payload,version);};
 sync.commit(data('primero'));const run=sync.reconcile();await sending.promise;sync.commit(data('primero','segundo'));gate.resolve();await run;
 assert.equal(state.writes.length,2);assert.deepEqual(state.remote.data,data('primero','segundo'));assert.equal(sync.snapshot().dirty,false);assert.equal(sync.snapshot().version,3);
});
test('los pendientes sobreviven una recarga sin conexión y se envían al reconectar',async t=>{
 const first=setup(t,{online:false});first.sync.commit(data('pendiente'));await first.sync.reconcile();assert.equal(first.sync.status().kind,'offline');
 const second=setup(t,{initial:first.state.stored});await second.sync.reconcile();assert.deepEqual(second.state.remote.data,data('pendiente'));assert.equal(second.sync.snapshot().dirty,false);
});
test('un cambio remoto con pendientes locales genera conflicto sin sobrescribir',async t=>{
 const {sync,state}=setup(t,{remote:{data:data('otro-dispositivo'),version:2}});sync.commit(data('mi-cambio'));await sync.reconcile();
 assert.equal(sync.status().kind,'conflict');assert.deepEqual(sync.snapshot().data,data('mi-cambio'));assert.equal(state.writes.length,0);
 const remote=await sync.previewRemote();sync.useRemote(remote);assert.deepEqual(sync.snapshot().data,data('otro-dispositivo'));assert.equal(sync.status().dirty,false);
});
test('no envía datos de una cuenta a otra',async t=>{
 const {sync,state}=setup(t);sync.commit(data('privado'));state.scope='project|account-b';await sync.reconcile();assert.equal(sync.status().kind,'conflict');assert.equal(state.writes.length,0);
});
test('un fallo de red conserva los pendientes',async t=>{
 const {sync,cloud}=setup(t);cloud.write=async()=>{throw new TypeError('sin red');};sync.commit(data('pendiente'));await sync.reconcile();assert.equal(sync.status().kind,'error');assert.equal(sync.snapshot().dirty,true);assert.equal(sync.snapshot().version,1);
});
test('recupera un envío confirmado en servidor cuya respuesta se perdió',async t=>{
 const {sync,state,cloud}=setup(t);const write=cloud.write;cloud.write=async(d,v)=>{await write(d,v);throw new TypeError('respuesta perdida');};sync.commit(data('guardado'));await sync.reconcile();
 assert.equal(sync.snapshot().dirty,true);cloud.write=write;await sync.reconcile();assert.equal(sync.snapshot().dirty,false);assert.equal(sync.snapshot().version,2);assert.equal(state.writes.length,1);
});
test('la igualdad ignora el orden de claves JSON que cambia Postgres',()=>{assert.ok(sameData({schema:2,groups:[],active:null},{active:null,groups:[],schema:2}));});
test('importa datos locales anteriores en una cuenta con respaldo vacío',async t=>{
 const {sync,state}=setup(t,{initial:{data:data('local'),owner:null,version:null,dirty:true}});await sync.reconcile();assert.deepEqual(state.remote.data,data('local'));assert.equal(state.writes.length,1);
});
test('no reemplaza un formulario abierto con datos remotos',async t=>{
 const {sync,state}=setup(t,{remote:{data:data('remoto'),version:2},canReplace:false});await sync.reconcile();assert.equal(sync.status().kind,'waiting');assert.equal(state.applied.length,0);state.canReplace=true;await sync.reconcile();assert.equal(state.applied.length,1);
});
test('si falla el guardado local, no se reconoce ni se envía el cambio',t=>{
 const {sync,state}=setup(t);const before=sync.snapshot();state.failStorage=true;assert.throws(()=>sync.commit(data('nuevo')),/No hay espacio/);assert.deepEqual(sync.snapshot(),before);assert.equal(state.writes.length,0);
});

test('un conflicto durante el envío mantiene los cambios locales y su versión base',async t=>{
 const {sync,cloud}=setup(t);cloud.write=async()=>{throw Object.assign(Error('Otro dispositivo guardó cambios.'),{code:'conflict'});};sync.commit(data('pendiente'));await sync.reconcile();assert.equal(sync.status().kind,'conflict');assert.equal(sync.snapshot().dirty,true);assert.equal(sync.snapshot().version,1);
});
