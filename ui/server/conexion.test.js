import test from 'node:test';
import assert from 'node:assert/strict';
import { manejarConexion } from './conexion.js';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const UUID2 = '223e4567-e89b-12d3-a456-426614174000';

function montar({ prompt = async (m) => (m.text ?? `/${m.skill ?? 'x'}`), guardadas = {} } = {}) {
  const enviados = [];
  const corridas = [];
  const almacenados = [];
  const almacen = {
    async leer(id) { return guardadas[id] ?? null; },
    async guardar(reg) { almacenados.push(JSON.parse(JSON.stringify(reg))); guardadas[reg.id] = reg; },
  };
  const h = manejarConexion({
    send: (o) => enviados.push(o),
    buildPrompt: prompt,
    startRun: ({ prompt: p, sessionId, modelo, emit }) => {
      const c = { prompt: p, sessionId, modelo, emit, kills: 0, respondidos: [], kill() { this.kills++; }, responder(id, d) { if (id === 'malo') throw new Error('pedido inválido'); this.respondidos.push([id, d]); } };
      corridas.push(c);
      return c;
    },
    almacen,
  });
  const run = (extra = {}) => h.onMessage(JSON.stringify({ type: 'run', skill: 'nuevo-cliente', ...extra }));
  const tipos = () => enviados.map((e) => e.type);
  return { h, enviados, corridas, almacenados, run, tipos };
}
const claude = (data) => ({ type: 'claude', data });

test('una ejecución en curso no se mata por mensajes ajenos (inválidos, desconocidos, otro run)', async () => {
  const { h, enviados, corridas, run } = montar();
  await run();
  assert.equal(h.ocupado, true);
  await h.onMessage('esto no es json');
  await h.onMessage(JSON.stringify({ type: 'ping' }));
  await h.onMessage(JSON.stringify(null));
  await run();
  assert.equal(corridas.length, 1);
  assert.equal(corridas[0].kills, 0, 'sigue viva');
  assert.ok(enviados.some((e) => e.type === 'error' && /en curso/.test(e.text)));
});

test('cancel mata la ejecución en curso; sin ejecución no hace nada', async () => {
  const { h, corridas, run } = montar();
  await h.onMessage(JSON.stringify({ type: 'cancel' }));
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

test('dos run seguidos sin esperar: solo se lanza uno', async () => {
  const { enviados, corridas, run } = montar({ prompt: async () => { await new Promise((r) => setTimeout(r, 5)); return '/x'; } });
  await Promise.all([run(), run()]);
  assert.equal(corridas.length, 1);
  assert.equal(enviados.filter((e) => e.type === 'error').length, 1);
});

test('un error al preparar el prompt libera el lugar y se informa', async () => {
  const { h, enviados, run } = montar({ prompt: async () => { throw new Error('Skill desconocido: x'); } });
  await run();
  assert.equal(h.ocupado, false);
  assert.deepEqual(enviados.at(-1), { type: 'error', text: 'Skill desconocido: x' });
});

test('si la ejecución termina de forma síncrona, el lugar queda libre y close no mata nada', async () => {
  const h = manejarConexion({
    send: () => {}, buildPrompt: async () => '/x',
    startRun: ({ emit }) => { emit({ type: 'done', code: 0 }); return { kill() { throw new Error('no debería matarse'); } }; },
  });
  await h.onMessage(JSON.stringify({ type: 'run', skill: 'x' }));
  assert.equal(h.ocupado, false);
  h.onClose();
});

test('los eventos del agente llegan como entradas y se guarda la sesión con su historial', async () => {
  const { h, enviados, corridas, almacenados, run, tipos } = montar();
  await run({ cliente: 'demo' });
  assert.deepEqual(tipos().slice(0, 2), ['start', 'entradas']);
  corridas[0].emit(claude({ type: 'system', subtype: 'init', session_id: UUID }));
  corridas[0].emit(claude({ type: 'assistant', session_id: UUID, message: { content: [{ type: 'text', text: 'Hola' }] } }));
  corridas[0].emit(claude({ type: 'assistant', session_id: UUID, message: { content: [{ type: 'text', text: 'Segundo' }] } }));
  corridas[0].emit({ type: 'done', code: 0 });
  await h.flush();
  assert.equal(enviados.filter((e) => e.type === 'sesion').length, 1, 'el id de sesión se informa una sola vez');
  assert.deepEqual(enviados.filter((e) => e.type === 'sesion')[0], { type: 'sesion', id: UUID });
  const ultimo = almacenados.at(-1);
  assert.equal(ultimo.id, UUID);
  assert.equal(ultimo.cliente, 'demo');
  assert.equal(ultimo.skill, 'nuevo-cliente');
  assert.deepEqual(ultimo.entradas.map((e) => e.text), ['/nuevo-cliente', 'Hola', 'Segundo', 'Proceso finalizado (código 0)']);
  assert.equal(h.ocupado, false);
});

test('los pedidos del agente se reenvían y su resolución queda en el historial', async () => {
  const { h, enviados, corridas, almacenados, run } = montar();
  await run();
  corridas[0].emit(claude({ type: 'system', session_id: UUID }));
  corridas[0].emit({ type: 'solicitud', id: 'r1', tool: 'AskUserQuestion', input: { questions: [] } });
  assert.ok(enviados.some((e) => e.type === 'solicitud' && e.id === 'r1'));
  assert.ok(!almacenados.some((r) => r.entradas.some((e) => /Respondiste/.test(e.text))), 'un pedido sin resolver no es una entrada');
  corridas[0].emit({ type: 'solicitud_resuelta', id: 'r1', resumen: 'Respondiste: Opción A' });
  await h.flush();
  assert.ok(enviados.some((e) => e.type === 'solicitud_resuelta' && e.id === 'r1'));
  assert.ok(almacenados.at(-1).entradas.some((e) => e.k === 'user' && e.text === 'Respondiste: Opción A'));
});

test('responder se encamina a la ejecución en curso; los errores son avisos y no matan nada', async () => {
  const { h, enviados, corridas, run } = montar();
  await h.onMessage(JSON.stringify({ type: 'responder', id: 'r1', decision: { permitir: true } }));
  assert.deepEqual(enviados.at(-1), { type: 'aviso', text: 'No hay una ejecución en curso.' });
  await run();
  await h.onMessage(JSON.stringify({ type: 'responder', id: 'r1', decision: { permitir: true } }));
  assert.deepEqual(corridas[0].respondidos, [['r1', { permitir: true }]]);
  await h.onMessage(JSON.stringify({ type: 'responder', id: 'malo', decision: {} }));
  assert.deepEqual(enviados.at(-1), { type: 'aviso', text: 'pedido inválido' });
  assert.equal(corridas[0].kills, 0);
  assert.equal(h.ocupado, true);
});

test('continuar una sesión guardada hereda su historial y usa --resume con ese id', async () => {
  const previa = { id: UUID, cliente: 'demo', skill: 'plan-del-dia', titulo: '/plan-del-dia demo', creada: 1, entradas: [{ k: 'user', text: '/plan-del-dia demo' }, { k: 'agent', text: '¿Aprobás?' }] };
  const { h, corridas, almacenados, run } = montar({ guardadas: { [UUID]: previa } });
  await run({ text: 'sí', sessionId: UUID });
  assert.equal(corridas[0].sessionId, UUID);
  corridas[0].emit(claude({ type: 'system', session_id: UUID }));
  corridas[0].emit({ type: 'done', code: 0 });
  await h.flush();
  const ultimo = almacenados.at(-1);
  assert.equal(ultimo.cliente, 'demo');
  assert.equal(ultimo.skill, 'plan-del-dia');
  assert.deepEqual(ultimo.entradas.map((e) => e.text).slice(0, 3), ['/plan-del-dia demo', '¿Aprobás?', 'sí']);
});

test('no se puede continuar una sesión que no está guardada (el id no viene de texto libre)', async () => {
  const { h, enviados, corridas, run } = montar();
  await run({ text: 'hola', sessionId: UUID2 });
  assert.equal(corridas.length, 0);
  assert.equal(h.ocupado, false);
  assert.match(enviados.at(-1).text, /ya no está guardada/);
});

test('si resumir cambia el id de sesión, el historial pasa a la nueva sin perder la anterior', async () => {
  const previa = { id: UUID, cliente: '', skill: 'x', titulo: 't', creada: 1, entradas: [{ k: 'user', text: 'antes' }] };
  const { h, corridas, almacenados, run } = montar({ guardadas: { [UUID]: previa } });
  await run({ text: 'sigo', sessionId: UUID });
  corridas[0].emit(claude({ type: 'system', session_id: UUID2 }));
  corridas[0].emit({ type: 'done', code: 0 });
  await h.flush();
  assert.equal(almacenados.at(-1).id, UUID2);
  assert.ok(almacenados.at(-1).entradas.some((e) => e.text === 'antes'));
  assert.equal(previa.id, UUID, 'la sesión anterior no se toca');
});

test('el modelo elegido viaja a startRun y se guarda en la sesión', async () => {
  const { h, corridas, almacenados, run } = montar();
  await run({ modelo: 'sonnet' });
  assert.equal(corridas[0].modelo, 'sonnet');
  corridas[0].emit(claude({ type: 'system', session_id: UUID }));
  corridas[0].emit({ type: 'done', code: 0 });
  await h.flush();
  assert.equal(almacenados.at(-1).modelo, 'sonnet');
});

test('un modelo no permitido hace fallar la ejecución con un error y libera el lugar', async () => {
  const h = manejarConexion({
    send: (o) => (h.enviados ??= []).push(o), buildPrompt: async () => '/x',
    startRun: () => { throw new Error('Modelo no permitido.'); },
  });
  await h.onMessage(JSON.stringify({ type: 'run', skill: 'x', modelo: 'raro' }));
  assert.equal(h.ocupado, false);
  assert.deepEqual(h.enviados.at(-1), { type: 'error', text: 'Modelo no permitido.' });
});

test('el costo es acumulado de la sesión: se toma el último total, no se suma', async () => {
  const previa = { id: UUID, cliente: '', skill: 'x', titulo: 't', creada: 1, costo: 0.5, modelo: 'haiku', entradas: [] };
  const { h, enviados, corridas, almacenados, run } = montar({ guardadas: { [UUID]: previa } });
  await run({ text: 'sigo', sessionId: UUID });
  corridas[0].emit(claude({ type: 'system', session_id: UUID }));
  corridas[0].emit(claude({ type: 'result', session_id: UUID, total_cost_usd: 0.62, num_turns: 1 }));
  corridas[0].emit({ type: 'done', code: 0 });
  await h.flush();
  assert.deepEqual(enviados.filter((e) => e.type === 'costo'), [{ type: 'costo', total: 0.62 }]);
  assert.equal(almacenados.at(-1).costo, 0.62);
  assert.equal(almacenados.at(-1).modelo, 'haiku', 'sin elegir otro, hereda el de la sesión');
});

test('un total_cost_usd inválido se ignora', async () => {
  const { h, enviados, corridas, run } = montar();
  await run();
  corridas[0].emit(claude({ type: 'result', session_id: UUID, total_cost_usd: 'mucho' }));
  assert.ok(!enviados.some((e) => e.type === 'costo'));
  corridas[0].emit({ type: 'done', code: 0 });
  await h.flush();
});

test('los permisos concedidos automáticamente se resumen en el historial al terminar', async () => {
  const { h, corridas, almacenados, run } = montar();
  await run();
  corridas[0].emit(claude({ type: 'system', session_id: UUID }));
  for (const t of ['Read', 'Read', 'mcp__gworkspace__list_events']) corridas[0].emit({ type: 'permiso_auto', tool: t, motivo: 'x' });
  corridas[0].emit({ type: 'done', code: 0 });
  await h.flush();
  const textos = almacenados.at(-1).entradas.map((e) => e.text);
  assert.ok(textos.some((t) => /Permisos concedidos automáticamente.*Read ×2.*mcp__gworkspace__list_events ×1/.test(t)), textos.join(' | '));
});

test('sin permisos automáticos no se agrega ninguna línea de auditoría', async () => {
  const { h, corridas, almacenados, run } = montar();
  await run();
  corridas[0].emit(claude({ type: 'system', session_id: UUID }));
  corridas[0].emit({ type: 'done', code: 0 });
  await h.flush();
  assert.ok(!almacenados.at(-1).entradas.some((e) => /automáticamente/.test(e.text)));
});
