import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseIndex,cents,schedule,obligation,periodTotals,validatePayment,validatePayout} from './engine.js';
const fixture = () => ({amount:20000,fine:1000,people:[{id:'a'},{id:'b'}],periods:[],payments:[],waivers:[],fundUses:[]});
const period = {id:'p',date:'2026-10-19',time:'18:00',person:'a'};
const later = Date.parse('2026-10-20T12:00:00-04:00');
test('todos los nombres pueden salir en cualquier puesto sin reglas especiales', () => {
 const names=['Maycol','Maicol Lopez','Ana','Luis'];
 for(let turn=0;turn<4;turn++) for(let i=0;i<4;i++) assert.equal(chooseIndex(names,turn,()=> (i+.1)/4),i);
 assert.equal(chooseIndex([],0),-1);for(let i=0;i<100;i++) assert.ok(chooseIndex(names,0)>=0);
});
test('montos exactos en centavos',()=>{assert.equal(cents('200.25'),20025);for(const bad of ['-2','NaN','0.001','1e4'])assert.throws(()=>cents(bad));});
test('calendario semanal y mensual sin saltos de fin de mes',()=>{
 assert.deepEqual(schedule('2026-10-19','weekly',3),['2026-10-19','2026-10-26','2026-11-02']);
 assert.deepEqual(schedule('2028-01-31','monthly',3),['2028-01-31','2028-02-29','2028-03-31']);
 assert.deepEqual(schedule('2026-10-19','custom',2,3),['2026-10-19','2026-10-22']);assert.throws(()=>schedule('2026-02-31','monthly',2));
});
test('límite boliviano, cuota parcial y multa única que persiste al pagar tarde',()=>{
 const g=fixture();g.payments.push({period:'p',person:'a',principal:10000,fine:0,at:'2026-10-19T18:00:00-04:00'});
 assert.equal(obligation(g,period,g.people[0],Date.parse('2026-10-19T22:00:00Z')).fine,0);
 assert.equal(obligation(g,period,g.people[0],later).fine,1000);
 g.payments.push({period:'p',person:'a',principal:10000,fine:1000,at:'2026-10-20T10:00:00-04:00'});
 const o=obligation(g,period,g.people[0],later);assert.equal(o.owed,0);assert.equal(o.fine,1000);assert.equal(o.fineOwed,0);assert.equal(periodTotals(g,period,later).principal,20000);
});
test('pago a tiempo registrado después, condonación y anulación',()=>{
 const g=fixture();g.payments.push({period:'p',person:'a',principal:20000,fine:0,at:'2026-10-19T17:00:00-04:00'});
 assert.equal(obligation(g,period,g.people[0],later).fine,0);g.payments[0].voided={reason:'Error'};assert.equal(obligation(g,period,g.people[0],later).owed,20000);
 g.waivers.push({period:'p',person:'a',reason:'Acuerdo'});assert.equal(obligation(g,period,g.people[0],later).fine,0);
});
test('rechaza pagos excesivos, futuros, QR sin verificar y multas improcedentes',()=>{
 const g=fixture();const p={principal:20000,fine:0,at:'2026-10-19T17:00:00-04:00',method:'QR',reference:'123',verified:true};
 assert.doesNotThrow(()=>validatePayment(g,period,g.people[0],p,later));
 for(const patch of [{principal:20001},{at:'2027-01-01T00:00:00Z'},{verified:false},{reference:''},{fine:1000}])assert.throws(()=>validatePayment(g,period,g.people[0],{...p,...patch},later));
});
test('el beneficiario sigue debiendo y las multas no completan un desembolso',()=>{
 const g=fixture();g.payments=[{period:'p',person:'b',principal:20000,fine:1000,at:'2026-10-20T10:00:00-04:00'}];
 assert.equal(obligation(g,period,g.people[0],later).owed,20000);assert.throws(()=>validatePayout(g,period));
 g.payments.push({period:'p',person:'a',principal:20000,fine:0,at:'2026-10-19T17:00:00-04:00'});
 assert.equal(validatePayout(g,period),40000);assert.throws(()=>validatePayout(g,{...period,payout:{amount:40000}}));
});
