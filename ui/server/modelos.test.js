import test from 'node:test';
import assert from 'node:assert/strict';
import { listarModelos, modeloPorDefecto, validarModelo } from './modelos.js';
import { argsDeClaude } from './runner.js';
import { entradasDe } from './entradas.js';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

test('la lista base trae opus, sonnet y haiku; FARO_MODELS suma otros con formato estricto', () => {
  assert.deepEqual(listarModelos({}).map((m) => m.id), ['opus', 'sonnet', 'haiku']);
  const ids = listarModelos({ FARO_MODELS: 'claude-fable-5-1, haiku, mal modelo, x;rm -rf, ' }).map((m) => m.id);
  assert.deepEqual(ids, ['opus', 'sonnet', 'haiku', 'claude-fable-5-1'], 'sin duplicados y sin ids con caracteres raros');
});

test('validarModelo: vacío = predeterminado; solo ids de la lista; nada de texto libre', () => {
  assert.equal(validarModelo('', {}), null);
  assert.equal(validarModelo(undefined, {}), null);
  assert.equal(validarModelo('sonnet', {}), 'sonnet');
  for (const mal of ['gpt-4', 'sonnet --dangerously-skip-permissions', '../x', 'SONNET', 5, {}, ['sonnet']]) {
    assert.throws(() => validarModelo(mal, {}), /no permitido/, JSON.stringify(mal));
  }
  assert.equal(validarModelo('claude-fable-5-1', { FARO_MODELS: 'claude-fable-5-1' }), 'claude-fable-5-1');
});

test('modeloPorDefecto toma FARO_MODEL solo si tiene formato válido', () => {
  assert.equal(modeloPorDefecto({ FARO_MODEL: 'haiku' }), 'haiku');
  assert.equal(modeloPorDefecto({ FARO_MODEL: 'a b; rm' }), '');
  assert.equal(modeloPorDefecto({}), '');
});

test('argsDeClaude: --model solo si se eligió uno permitido; el elegido pisa al predeterminado', () => {
  const sin = argsDeClaude({ env: {} });
  assert.ok(!sin.includes('--model'), 'sin elección se usa el modelo de Claude Code');
  const elegido = argsDeClaude({ modelo: 'sonnet', sessionId: UUID, env: {} });
  assert.deepEqual(elegido.slice(elegido.indexOf('--model'), elegido.indexOf('--model') + 2), ['--model', 'sonnet']);
  assert.ok(elegido.includes('--resume'));
  const porDefecto = argsDeClaude({ env: { FARO_MODEL: 'haiku' } });
  assert.equal(porDefecto[porDefecto.indexOf('--model') + 1], 'haiku');
  const pisa = argsDeClaude({ modelo: 'opus', env: { FARO_MODEL: 'haiku' } });
  assert.equal(pisa[pisa.indexOf('--model') + 1], 'opus');
});

test('argsDeClaude rechaza modelos fuera de la lista y ids de sesión inválidos', () => {
  assert.throws(() => argsDeClaude({ modelo: 'x --foo', env: {} }), /no permitido/);
  assert.throws(() => argsDeClaude({ sessionId: '../x', env: {} }), /sessionId inválido/);
});

test('el modelo realmente usado queda en el historial al iniciar', () => {
  assert.deepEqual(entradasDe({ type: 'system', subtype: 'init', model: 'claude-opus-4-8' }), [{ k: 'meta', text: 'Modelo: claude-opus-4-8' }]);
  assert.deepEqual(entradasDe({ type: 'system', subtype: 'init' }), []);
});
