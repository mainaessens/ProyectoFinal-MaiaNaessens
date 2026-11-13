import test from 'node:test';
import assert from 'node:assert/strict';
import { manejarConexion } from './conexion.js';
import { startRun } from './runner.js';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

function montar({ prompt = async (m) => `/${m.skill ?? 'texto'}` } = {}) {
  const enviados = [];
  const corridas = [];
  const h = manejarConexion({
    send: (o) => enviados.push(o),
    buildPrompt: prompt,
    startRun: ({ prompt: p, sessionId, emit }) => {
      const c = { prompt: p, sessionId, emit, kills: 0, kill() { this.kills++; } };
      corridas.push(c);
      return c;
    },
  });
  const run = (extra = {}) => h.onMessage(JSON.stringify({ type: 'run', skill: 'nuevo-cliente', ...extra }));
  return { h, enviados, corridas, run };
}

test('una ejecución en curso no se mata por mensajes ajenos (inválidos, desconocidos, otro run)', async () => {
  const { h, enviados, corridas, run } = montar();
  await run();
  assert.equal(h.ocupado, true);
  await h.onMessage('esto no es json');
  await h.onMessage(JSON.stringify({ type: 'ping' }));
  await h.onMessage(JSON.stringify(null));
  await run(); // segundo run mientras hay uno activo
  assert.equal(corridas.length, 1);
  assert.equal(corridas[0].kills, 0, 'sigue viva');
  assert.ok(enviados.some((e) => e.type === 'error' && /en curso/.test(e.text)));
  assert.equal(h.ocupado, true);
});

test('cancel mata la ejecución en curso; sin ejecución no hace nada', async () => {
  const { h, corridas, run } = montar();
  await h.onMessage(JSON.stringify({ type: 'cancel' })); // no hay nada que cancelar
  await run();
  await h.onMessage(JSON.stringify({ type: 'cancel' }));
  assert.equal(corridas[0].kills, 1);
});

test('cerrar la conexión cancela la ejecución en curso', async () => {
  const { h, corridas, run } = montar();
  await run();
  h.onClose();
  assert.equal(corridas[0].kills, 1);
  assert.equal(h.ocupado, false);
});

test('si la conexión se cierra mientras se prepara el prompt, no se lanza ningún proceso', async () => {
  let liberar;
  const espera = new Promise((r) => { liberar = r; });
  const { h, corridas, run } = montar({ prompt: async () => { await espera; return '/x'; } });
  const p = run();
  h.onClose();
  liberar();
  await p;
  assert.equal(corridas.length, 0);
});

test('dos run seguidos sin esperar: solo se lanza uno (la reserva ocurre antes del await)', async () => {
  const { enviados, corridas, run } = montar({ prompt: async () => { await new Promise((r) => setTimeout(r, 5)); return '/x'; } });
  await Promise.all([run(), run()]);
  assert.equal(corridas.length, 1);
  assert.equal(enviados.filter((e) => e.type === 'error').length, 1);
});

test('al terminar (done) se libera el lugar y se puede responder con la misma sesión', async () => {
  const { h, enviados, corridas, run } = montar();
  await run();
  corridas[0].emit({ type: 'done', code: 0 });
  assert.equal(h.ocupado, false);
  await h.onMessage(JSON.stringify({ type: 'run', text: 'sí, aprobado', sessionId: UUID }));
  assert.equal(corridas.length, 2);
  assert.equal(corridas[1].sessionId, UUID, 'el sessionId viaja a startRun (usa --resume)');
  assert.ok(enviados.some((e) => e.type === 'start'));
});

test('si la ejecución termina de forma síncrona, el lugar queda libre', async () => {
  const enviados = [];
  const h = manejarConexion({
    send: (o) => enviados.push(o),
    buildPrompt: async () => '/x',
    startRun: ({ emit }) => { emit({ type: 'done', code: 0 }); return { kill() { throw new Error('no debería matarse'); } }; },
  });
  await h.onMessage(JSON.stringify({ type: 'run', skill: 'x' }));
  assert.equal(h.ocupado, false);
  h.onClose(); // no debe intentar matar una ejecución ya terminada
});

test('un error al preparar el prompt libera el lugar y se informa', async () => {
  const { h, enviados, run } = montar({ prompt: async () => { throw new Error('Skill desconocido: x'); } });
  await run();
  assert.equal(h.ocupado, false);
  assert.deepEqual(enviados.at(-1), { type: 'error', text: 'Skill desconocido: x' });
});

test('startRun rechaza un sessionId que no es UUID antes de lanzar nada', () => {
  assert.throws(() => startRun({ prompt: 'x', sessionId: '../etc/passwd', emit() {} }), /sessionId inválido/);
  assert.throws(() => startRun({ prompt: 'x', sessionId: 'a b; rm -rf', emit() {} }), /sessionId inválido/);
});
