import { parseNames, chooseIndex } from './engine.js';

const $ = id => document.getElementById(id);
const colors = ['#ad91e8','#f1ad7b','#88bec1','#ef91aa','#9dabe2','#e6c36e','#a7c58c','#cb96c9'];
const storageKey = 'la-ruleta-v1';
let state = { original: [], remaining: [], history: [], pending: null, started: false };
let rotation = 0;
let spinning = false;
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && Array.isArray(saved.original) && Array.isArray(saved.remaining) && Array.isArray(saved.history) && [...saved.original, ...saved.remaining, ...saved.history].every(n => typeof n === 'string') && (saved.pending === null || (Number.isInteger(saved.pending) && saved.pending >= 0 && saved.pending < saved.remaining.length))) {
    state = { ...saved, started: Boolean(saved.started) };
  }
} catch { storageAvailable = false; }

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { storageAvailable = false; }
  if (!storageAvailable) $('message').textContent = 'El navegador no permite guardar. Descarga el historial antes de cerrar.';
}

function draw(angle = rotation) {
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const names = state.remaining;
  const entries = names.length ? names : ['Tu próximo turno', 'Empieza aquí', 'Agrega nombres', 'Gira y descubre', '¿Quién sigue?', 'Todos participan'];
  const arc = Math.PI * 2 / entries.length;
  ctx.clearRect(0, 0, 1000, 1000);
  ctx.save();
  ctx.translate(500, 500);
  ctx.rotate(angle);
  entries.forEach((name, index) => {
    const start = index * arc - Math.PI / 2;
    ctx.beginPath();ctx.moveTo(0, 0);ctx.arc(0, 0, 500, start, start + arc);ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];ctx.fill();
    ctx.strokeStyle = '#ffffff70';ctx.lineWidth = 2;ctx.stroke();
    if (entries.length > 60) return;
    ctx.save();ctx.rotate(start + arc / 2);
    ctx.textAlign = 'right';ctx.textBaseline = 'middle';ctx.fillStyle = '#302738';
    ctx.font = `600 ${entries.length > 25 ? 15 : entries.length > 12 ? 22 : 29}px "DM Sans", sans-serif`;
    let label = name;
    while (ctx.measureText(label).width > 310 && label.length > 1) label = label.slice(0, -1);
    if (label !== name) label = label.slice(0, -1) + '…';
    ctx.fillText(label, 450, 0);ctx.restore();
  });
  ctx.restore();
}

function render() {
  $('input-count').textContent = parseNames($('names').value).length;
  $('history-count').textContent = state.history.length;
  $('remaining').textContent = state.remaining.length ? `${state.remaining.length} ${state.remaining.length === 1 ? 'participante en la rueda' : 'participantes en la rueda'}` : state.started ? '¡Todos tuvieron su turno!' : 'Agrega nombres para comenzar';
  $('spin').disabled = spinning || state.pending !== null || !state.remaining.length;
  $('names').disabled = state.started || spinning;
  $('apply').disabled = state.started || spinning;
  $('restart').disabled = spinning || state.pending !== null;
  $('names-hint').textContent = state.started ? 'Para editar la lista, empieza de nuevo.' : 'También puedes separar los nombres con comas.';
  $('wheel-caption').textContent = state.started && !state.remaining.length ? 'Sorteo completo. Tu historial está listo para descargar.' : 'Un clic. Un nuevo turno.';
  $('download').disabled = !state.history.length;
  $('empty-history').hidden = Boolean(state.history.length);
  $('history').replaceChildren(...state.history.map((name, index) => {
    const li = document.createElement('li');const number = document.createElement('span');
    number.className = 'position';number.textContent = index + 1;
    const label = document.createElement('span');label.textContent = name;
    li.append(number, label);return li;
  }));
  draw();
}

$('names').value = state.original.join('\n');
$('names').addEventListener('input', () => { $('input-count').textContent = parseNames($('names').value).length; });
$('apply').addEventListener('click', () => {
  const names = parseNames($('names').value);
  state = { original: names, remaining: [...names], history: [], pending: null, started: false };
  rotation = 0;save();render();
  $('message').textContent = storageAvailable ? (names.length ? 'Lista guardada. ¡Todo listo para girar!' : 'Ingresa los nombres para comenzar.') : 'El guardado automático no está disponible.';
});

function showResult() {
  $('result-title').textContent = state.remaining[state.pending];
  if (!$('result-dialog').open) $('result-dialog').showModal();
}

$('spin').addEventListener('click', () => {
  if (spinning || state.pending !== null || !state.remaining.length) return;
  // Unconfirmed edits must be saved before the first draw.
  if (!state.started && JSON.stringify(parseNames($('names').value)) !== JSON.stringify(state.original)) {
    $('message').textContent = 'Guarda los nombres antes de girar.'; $('apply').focus();return;
  }
  state.pending = chooseIndex(state.remaining, state.history.length);
  state.started = true;spinning = true;save();render();$('message').textContent = '';
  const tau = Math.PI * 2;
  const arc = tau / state.remaining.length;
  const target = (tau - (state.pending + .5) * arc) % tau;
  const from = rotation;
  const to = from + tau * 5 + ((target - from % tau + tau) % tau);
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 4200;
  const start = performance.now();
  function frame(now) {
    const progress = duration ? Math.min((now - start) / duration, 1) : 1;
    rotation = from + (to - from) * (1 - Math.pow(1 - progress, 4));draw();
    if (progress < 1) requestAnimationFrame(frame);
    else { rotation = target;spinning = false;render();showResult(); }
  }
  requestAnimationFrame(frame);
});

$('result-dialog').addEventListener('cancel', event => event.preventDefault());
$('accept').addEventListener('click', () => {
  if (state.pending === null) return;
  const [name] = state.remaining.splice(state.pending, 1);
  state.history.push(name);state.pending = null;rotation = 0;save();
  $('result-dialog').close();render();
  $('message').textContent = `${name} se guardó en el puesto ${state.history.length}.`;
  if (state.remaining.length) $('spin').focus();else $('download').focus();
});

$('restart').addEventListener('click', () => {
  if (state.history.length) $('restart-dialog').showModal();else restart();
});
function restart() {
  state = { original: [...state.original], remaining: [...state.original], history: [], pending: null, started: false };
  $('names').value = state.original.join('\n');rotation = 0;save();render();
  $('message').textContent = 'Puedes editar la lista o comenzar otro sorteo.';$('names').focus();
}
$('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
$('confirm-restart').addEventListener('click', () => { $('restart-dialog').close();restart(); });
$('download').addEventListener('click', () => {
  const text = 'ORDEN DE SALIDA\n\n' + state.history.map((name, index) => `${index + 1}. ${name}`).join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');link.href = url;link.download = 'orden-de-salida.txt';link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
render();
if (!storageAvailable) $('message').textContent = 'El guardado automático no está disponible en este navegador.';
if (state.pending !== null) showResult();
document.fonts.ready.then(() => draw());
