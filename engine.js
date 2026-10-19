export const ZONE = 'America/La_Paz';
export const parseNames = text => text.split(/[\n,;]+/).map(n => n.trim()).filter(Boolean);
export function chooseIndex(names, _count, random) {
  if (!names.length) return -1;
  if (random) return Math.floor(random() * names.length);
  // Rejection sampling avoids modulo bias. Names never affect the result.
  const range = 2 ** 32, limit = range - range % names.length;
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % names.length;
}
export const normalizeName = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export const parseOrderedNames = text => parseNames(text).map(name => name.replace(/^\d+[.)]\s+/, '').trim());
export function resolveManualOrder(group, text) {
  const names = parseOrderedNames(text);
  if (names.length !== group.people.length) throw Error(`Incluye a las ${group.people.length} personas, una vez cada una.`);
  const people = new Map(group.people.map(p => [normalizeName(p.name), p.id]));
  if (people.size !== group.people.length) throw Error('Hay participantes con nombres iguales. Revisa la lista del grupo.');
  const order = names.map(name => {
    const id = people.get(normalizeName(name));
    if (!id) throw Error(`«${name}» no está en el grupo. Usa su nombre tal como lo registraste.`);
    return id;
  });
  if (new Set(order).size !== order.length) throw Error('Hay nombres repetidos. Cada persona debe aparecer una sola vez.');
  return order;
}
export function applyManualOrder(group, order) {
  if (group.order.length || group.pending || group.periods.some(p => p.person || p.payout)) throw Error('El grupo ya tiene turnos asignados o un sorteo pendiente. No se puede reemplazar su orden.');
  const people = new Set(group.people.map(p => p.id));
  if (group.periods.length !== people.size || order.length !== people.size || new Set(order).size !== people.size || order.some(id => !people.has(id))) throw Error('El orden debe incluir a cada participante exactamente una vez.');
  group.order = [...order];
  group.periods.forEach((p, i) => { p.person = order[i]; });
  group.assignment = 'manual';
}
export function cents(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw Error('Usa un monto positivo con hasta dos decimales.');
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount > 100000000) throw Error('El monto es demasiado grande.');
  return amount;
}
export const money = value => `Bs ${new Intl.NumberFormat('es-BO', {minimumFractionDigits:2, maximumFractionDigits:2}).format(value / 100)}`;
export function localNow(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone:ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(date).replace(' ', 'T');
}
export const deadline = period => Date.parse(`${period.date}T${period.time}:00-04:00`);
export function schedule(start, frequency, count, interval = 7) {
  const [year, month, day] = start.split('-').map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(anchor.getTime()) || anchor.toISOString().slice(0,10) !== start) throw Error('La fecha no es válida.');
  return Array.from({length:count}, (_, i) => {
    let date;
    if (frequency === 'monthly') {
      const last = new Date(Date.UTC(year, month - 1 + i + 1, 0)).getUTCDate();
      date = new Date(Date.UTC(year, month - 1 + i, Math.min(day, last)));
    } else date = new Date(anchor.getTime() + i * (frequency === 'weekly' ? 7 : interval) * 86400000);
    return date.toISOString().slice(0,10);
  });
}
export function obligation(group, period, person, now = Date.now()) {
  const records = group.payments.filter(p => p.period === period.id && p.person === person.id && !p.voided);
  const principal = records.reduce((s,p) => s + p.principal, 0);
  const finePaid = records.reduce((s,p) => s + p.fine, 0);
  const onTime = records.filter(p => Date.parse(p.at) <= deadline(period)).reduce((s,p) => s + p.principal, 0);
  const late = now > deadline(period) && onTime < group.amount;
  const waiver = group.waivers.find(w => w.period === period.id && w.person === person.id);
  const fine = late && !waiver ? group.fine : 0;
  return {principal, finePaid, fine, late, waiver, owed:Math.max(0,group.amount-principal), fineOwed:Math.max(0,fine-finePaid)};
}
export function periodTotals(group, period, now = Date.now()) {
  return group.people.reduce((s, person) => {
    const o = obligation(group, period, person, now);
    for (const key of ['principal','fine','finePaid','owed','fineOwed']) s[key] += o[key];
    if (!o.owed) s.complete++;
    return s;
  }, {principal:0, fine:0, finePaid:0, owed:0, fineOwed:0, complete:0});
}
export function groupTotals(group, now = Date.now()) {
  const totals = group.periods.reduce((s,p) => {
    const t = periodTotals(group,p,now);
    s.principal += t.principal;s.fine += t.fine;s.finePaid += t.finePaid;
    if (deadline(p) < now) s.overdue += t.owed;
    s.disbursed += p.payout ? p.payout.amount : 0;
    return s;
  },{principal:0,fine:0,finePaid:0,overdue:0,disbursed:0});
  totals.fineUsed = group.fundUses.reduce((s,r) => s + (r.voided ? 0 : r.amount),0);
  return totals;
}
export function validatePayment(group, period, person, payment, now = Date.now()) {
  if (!Number.isSafeInteger(payment.principal) || !Number.isSafeInteger(payment.fine) || payment.principal < 0 || payment.fine < 0 || payment.principal + payment.fine <= 0) throw Error('Ingresa un aporte o una multa mayor a cero.');
  const date = Date.parse(payment.at);
  if (!Number.isFinite(date) || date > now + 60000) throw Error('La fecha del pago no puede estar en el futuro.');
  const o = obligation(group,period,person,now);
  if (payment.principal > o.owed) throw Error('El aporte supera el saldo pendiente de esta cuota.');
  const onTimeBefore = group.payments.filter(p => !p.voided && p.period===period.id && p.person===person.id && Date.parse(p.at)<=deadline(period)).reduce((s,p)=>s+p.principal,0);
  const onTimeAfter = onTimeBefore + (date <= deadline(period) ? payment.principal : 0);
  const dueFineAfter = now > deadline(period) && onTimeAfter < group.amount && !o.waiver ? group.fine : 0;
  if (payment.fine + o.finePaid > dueFineAfter) throw Error('La multa supera el saldo, o la fecha indicada elimina una multa ya cobrada. Revisa los registros.');
  if (!['QR','Efectivo','Transferencia'].includes(payment.method)) throw Error('Selecciona el medio de pago.');
  if (payment.method !== 'Efectivo' && !payment.reference.trim()) throw Error('Ingresa la referencia del depósito verificado.');
  if (!payment.verified) throw Error('Confirma que verificaste la recepción del dinero.');
}
export function validatePayout(group, period) {
  if (!period.person) throw Error('Primero asigna el beneficiario.');
  if (period.payout) throw Error('Este turno ya tiene un desembolso registrado.');
  if (periodTotals(group,period).owed) throw Error('Faltan aportes para completar este fondo.');
  return group.amount * group.people.length;
}
