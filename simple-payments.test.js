import test from 'node:test';
import assert from 'node:assert/strict';
import {enableManualFines,assessFine,quickPayment,undoPayment,obligation,groupTotals} from './engine.js';
const now=Date.parse('2026-10-26T12:00:00-04:00');
let serial=0;const id=()=>String(++serial);
const fixture=()=>({amount:20000,fine:1000,people:[{id:'a',name:'Ana'},{id:'b',name:'Luis'}],periods:[{id:'p',date:'2026-10-19',time:'18:00',person:'a',payout:null},{id:'q',date:'2026-11-19',time:'18:00',person:'b',payout:null}],payments:[],waivers:[],fundUses:[],audit:[],fineMode:'manual',fineAssessments:[]});
test('el reloj no genera multas y registrar un pago no aplica una multa',()=>{
 const g=fixture(),p=g.periods[0],who=g.people[0];
 assert.equal(obligation(g,p,who,now).fine,0);
 const r=quickPayment(g,p,who,'principal',now,id);
 assert.equal(r.principal,20000);assert.equal(r.fine,0);assert.equal(r.method,'Sin especificar');
 assert.throws(()=>quickPayment(g,p,who,'principal',now,id));
 assert.equal(obligation(g,p,who,now+86400000*60).fine,0);
});
test('multa manual independiente del aporte, sin duplicados y reversible',()=>{
 const g=fixture(),p=g.periods[0],who=g.people[0];
 assessFine(g,p,who,now,id);assert.throws(()=>assessFine(g,p,who,now,id));
 const fine=quickPayment(g,p,who,'fine',now,id);
 assert.equal(obligation(g,p,who,now).owed,20000);assert.equal(obligation(g,p,who,now).fineOwed,0);
 undoPayment(g,fine,now);assert.equal(obligation(g,p,who,now).fineOwed,1000);
 const pay=quickPayment(g,p,who,'principal',now,id);
 assert.equal(obligation(g,p,who,now).fineOwed,1000);
 undoPayment(g,pay,now);assert.equal(obligation(g,p,who,now).owed,20000);
 assert.throws(()=>undoPayment(g,pay,now));
});
test('no se deshace un aporte entregado ni dinero de multas ya utilizado',()=>{
 const g=fixture(),p=g.periods[0],who=g.people[0];
 const r=quickPayment(g,p,who,'principal',now,id);p.payout={amount:40000};
 assert.throws(()=>undoPayment(g,r,now));
 assessFine(g,p,who,now,id);const fine=quickPayment(g,p,who,'fine',now,id);g.fundUses.push({amount:1000});
 assert.throws(()=>undoPayment(g,fine,now));assert.equal(groupTotals(g,now).fineUsed,1000);
});
test('migración conserva pagos, multas anteriores, calendario e historial y se ejecuta una vez',()=>{
 const g=fixture();delete g.fineMode;delete g.fineAssessments;
 g.payments.push({id:'old',period:'p',person:'a',principal:20000,fine:1000,at:'2026-10-20T12:00:00-04:00'});
 const before=groupTotals(g,now),records=structuredClone(g.payments),periods=structuredClone(g.periods);
 assert.equal(enableManualFines(g,now,id),true);
 assert.deepEqual(groupTotals(g,now),before);assert.deepEqual(g.payments,records);assert.deepEqual(g.periods,periods);
 assert.equal(g.fineAssessments.length,2);assert.equal(g.audit.length,1);
 assert.equal(enableManualFines(g,now+86400000*60,id),false);
 assert.equal(obligation(g,g.periods[1],g.people[0],now+86400000*60).fine,0);
 assert.equal(obligation(g,g.periods[0],g.people[1],now).fineOwed,1000);
});
test('un aporte parcial anterior se completa con el saldo exacto',()=>{
 const g=fixture();g.payments.push({period:'p',person:'a',principal:7250,fine:0,at:'2026-10-19T12:00:00-04:00'});
 assert.equal(quickPayment(g,g.periods[0],g.people[0],'principal',now,id).principal,12750);
 assert.equal(obligation(g,g.periods[0],g.people[0],now).principal,20000);
});
