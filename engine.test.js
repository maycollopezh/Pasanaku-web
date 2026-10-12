import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNames, isPriorityName, chooseIndex } from './engine.js';

test('lee listas sin descartar entradas repetidas', () => {
  assert.deepEqual(parseNames(' Ana\nLuis, ;Ana\n '), ['Ana', 'Luis', 'Ana']);
});
test('reconoce las variantes exactas y normaliza mayúsculas y espacios', () => {
  for (const name of ['Maycol', 'MAICOL', 'maycol lopez', ' Maicol  López ']) assert.ok(isPriorityName(name));
  for (const name of ['Maycola', 'Luis Maycol', 'Maycol Perez', '']) assert.equal(isPriorityName(name), false);
});
test('reserva el segundo puesto durante sorteos completos', () => {
  for (const special of ['Maycol', 'maicol', 'MAYCOL LOPEZ', 'Maicol Lopez']) {
    for (let run = 0; run < 200; run++) {
      const names = ['Ana', special, 'Luis', 'Sofía', 'Diego'];const result = [];
      while (names.length) result.push(...names.splice(chooseIndex(names, result.length), 1));
      assert.equal(result[1], special);assert.equal(new Set(result).size, 5);
    }
  }
});
test('la selección aleatoria alcanza todos los candidatos permitidos', () => {
  const names = ['Ana', 'Maycol', 'Luis', 'Diego'];
  assert.equal(chooseIndex(names, 0, () => 0), 0);
  assert.equal(chooseIndex(names, 0, () => .5), 2);
  assert.equal(chooseIndex(names, 0, () => .999), 3);
  for (let index = 0; index < 4; index++) assert.equal(chooseIndex(names, 2, () => (index + .1) / 4), index);
});
test('maneja lista vacía, un participante y múltiples variantes', () => {
  assert.equal(chooseIndex([], 0), -1);assert.equal(chooseIndex(['Maycol'], 0), 0);
  assert.equal(chooseIndex(['Maycol', 'Maicol', 'Ana'], 0), 2);
  assert.equal(chooseIndex(['Maycol', 'Maicol'], 1, () => 0), 0);
  assert.equal(chooseIndex(['Maycol', 'Maicol'], 1, () => .999), 1);
  assert.equal(chooseIndex(['Maycol', 'Maicol'], 0, () => .999), 1);
});
