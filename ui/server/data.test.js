import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faro-'));
fs.mkdirSync(path.join(root, 'clientes', 'demo', 'historial'), { recursive: true });
fs.mkdirSync(path.join(root, 'clientes', 'plantilla'), { recursive: true });
fs.mkdirSync(path.join(root, '.claude', 'skills', 'crear-post'), { recursive: true });
fs.writeFileSync(path.join(root, '.claude', 'skills', 'crear-post', 'SKILL.md'), '---\nname: crear-post\ndescription: Arma un post\n---\n');
fs.writeFileSync(path.join(root, 'clientes', 'demo', 'historial', 'a.plan.json'), JSON.stringify({ aprobado: false, hook_texto: 'Hola' }));
process.env.AGENCIA_ROOT = root;

const data = await import('./data.js');
const { buildPrompt } = await import('./runner.js');

test('safeSlug rechaza path traversal', () => {
  assert.equal(data.safeSlug('demo'), 'demo');
  assert.equal(data.safeSlug('../etc'), null);
  assert.equal(data.safeSlug('A b'), null);
  assert.equal(data.safePlanFile('a.plan.json'), 'a.plan.json');
  assert.equal(data.safePlanFile('../a.plan.json'), null);
});

test('listClientes omite plantilla y cuenta pendientes', async () => {
  const c = await data.listClientes();
  assert.deepEqual(c.map((x) => x.slug), ['demo']);
  assert.equal(c[0].planes.pendientes, 1);
});

test('decidirPlan aprueba, rechaza y deja rastro en el log', async () => {
  const ok = await data.decidirPlan('demo', 'a.plan.json', true);
  assert.equal(ok.aprobado, true);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'clientes', 'demo', 'historial', 'a.plan.json'), 'utf8'));
  assert.equal(saved.aprobado, true);
  assert.equal(saved.hook_texto, 'Hola');
  const no = await data.decidirPlan('demo', 'a.plan.json', false);
  assert.equal(no.aprobado, false);
  assert.equal(no.estado, 'rechazado');
  assert.equal((await data.readLog('demo')).length, 2);
});

test('buildPrompt solo acepta skills existentes y una línea de argumentos', async () => {
  assert.equal(await buildPrompt({ skill: 'crear-post', cliente: 'demo', args: 'tema\nmalicioso' }), '/crear-post demo tema malicioso');
  await assert.rejects(buildPrompt({ skill: 'rm -rf', cliente: 'demo' }));
  await assert.rejects(buildPrompt({ skill: 'crear-post', cliente: '../x' }));
});
