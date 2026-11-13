import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearAlmacen, esIdValido } from './sesiones.js';
import { entradasDe } from './entradas.js';

const id = (n) => `${String(n).padStart(8, '0')}-e89b-12d3-a456-426614174000`;
const nuevo = (extra = {}) => crearAlmacen({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'faro-ses-')), ...extra });

test('guarda, lee y lista sesiones (la más reciente primero) y filtra por cliente', async () => {
  const a = nuevo();
  await a.guardar({ id: id(1), cliente: 'demo', skill: 'plan-del-dia', titulo: 'uno', entradas: [{ k: 'user', text: 'hola' }] });
  await new Promise((r) => setTimeout(r, 5));
  await a.guardar({ id: id(2), cliente: 'otro', skill: 'crear-post', titulo: 'dos', entradas: [] });
  const todas = await a.listar();
  assert.deepEqual(todas.map((s) => s.id), [id(2), id(1)]);
  assert.deepEqual((await a.listar({ cliente: 'demo' })).map((s) => s.id), [id(1)]);
  assert.equal(todas[1].entradas, 1);
  assert.deepEqual((await a.leer(id(1))).entradas, [{ k: 'user', text: 'hola' }]);
  assert.equal(await a.existe(id(1)), true);
  assert.equal(await a.existe(id(9)), false);
});

test('borrar elimina la sesión; leer de algo inexistente da null', async () => {
  const a = nuevo();
  await a.guardar({ id: id(1), entradas: [] });
  await a.borrar(id(1));
  assert.equal(await a.leer(id(1)), null);
});

test('rechaza ids que no son UUID (sin recorridos de directorio)', async () => {
  const a = nuevo();
  for (const mal of ['../x', 'a/b', '', 'abc', null, `${id(1)}/../x`]) {
    assert.equal(esIdValido(mal), false, String(mal));
    await assert.rejects(a.leer(mal), /inválido/);
    await assert.rejects(a.guardar({ id: mal, entradas: [] }), /inválido/);
  }
});

test('poda las más viejas al superar el máximo', async () => {
  const a = nuevo({ max: 2 });
  for (const n of [1, 2, 3]) { await a.guardar({ id: id(n), entradas: [] }); await new Promise((r) => setTimeout(r, 5)); }
  assert.deepEqual((await a.listar()).map((s) => s.id), [id(3), id(2)]);
});

test('limita la cantidad y el tamaño de las entradas', async () => {
  const a = nuevo();
  const muchas = Array.from({ length: 900 }, (_, i) => ({ k: 'agent', text: `m${i}` }));
  muchas.push({ k: 'agent', text: 'x'.repeat(30000) });
  await a.guardar({ id: id(1), entradas: muchas });
  const r = await a.leer(id(1));
  assert.equal(r.entradas.length, 800);
  assert.equal(r.entradas.at(-1).text.length, 20000);
});

test('un archivo dañado se trata como inexistente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faro-ses-'));
  fs.writeFileSync(path.join(dir, `${id(1)}.json`), '{no es json');
  const a = crearAlmacen({ dir });
  assert.equal(await a.leer(id(1)), null);
  assert.deepEqual(await a.listar(), []);
});

test('entradasDe resume herramientas y marca errores de autenticación con el paso a seguir', () => {
  const tool = entradasDe({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'a.md' } }, { type: 'text', text: ' ' }] } });
  assert.equal(tool.length, 1);
  assert.match(tool[0].text, /^Read /);
  const err = entradasDe({ type: 'result', is_error: true, result: 'Failed to authenticate: OAuth session expired' });
  assert.equal(err[0].k, 'err');
  assert.match(err[0].text, /\/login/);
  assert.deepEqual(entradasDe(null), []);
});
