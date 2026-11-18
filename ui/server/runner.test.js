import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { construirRespuesta, startRun } from './runner.js';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const PREGUNTAS = { questions: [
  { question: '¿A o B?', header: 'Opción', multiSelect: false, options: [{ label: 'A' }, { label: 'B' }] },
  { question: '¿Qué extras?', header: 'Extras', multiSelect: true, options: [{ label: 'X' }, { label: 'Y' }] },
] };

// ---- construirRespuesta (pura)
test('AskUserQuestion: arma answers por pregunta (selección múltiple se une con coma)', () => {
  const { respuesta, resumen } = construirRespuesta({ tool: 'AskUserQuestion', input: PREGUNTAS }, { respuestas: ['B', ['X', 'Y']] });
  assert.equal(respuesta.behavior, 'allow');
  assert.deepEqual(respuesta.updatedInput.answers, { '¿A o B?': 'B', '¿Qué extras?': 'X, Y' });
  assert.equal(respuesta.updatedInput.questions.length, 2, 'conserva las preguntas originales');
  assert.match(resumen, /Respondiste: B · X, Y/);
});

test('AskUserQuestion: acepta respuesta libre («Otro») y rechaza lo inválido', () => {
  const p = { tool: 'AskUserQuestion', input: PREGUNTAS };
  assert.equal(construirRespuesta(p, { respuestas: ['algo propio', 'X'] }).respuesta.updatedInput.answers['¿A o B?'], 'algo propio');
  for (const mal of [{}, { respuestas: ['A'] }, { respuestas: ['A', 'X', 'Z'] }, { respuestas: ['', 'X'] }, { respuestas: [5, 'X'] }, { respuestas: ['x'.repeat(501), 'X'] }, { respuestas: [['A', 'B'], 'X'] }, null]) {
    assert.throws(() => construirRespuesta(p, mal), /inválida/, JSON.stringify(mal));
  }
});

test('AskUserQuestion: cancelar la deniega con un mensaje', () => {
  const { respuesta } = construirRespuesta({ tool: 'AskUserQuestion', input: PREGUNTAS }, { cancelar: true });
  assert.equal(respuesta.behavior, 'deny');
  assert.match(respuesta.message, /canceló/);
});

test('permiso: permitir devuelve la misma entrada; denegar deja un mensaje', () => {
  const p = { tool: 'Write', input: { file_path: 'a.txt', content: 'x' }, sugerencias: [{ type: 'setMode', mode: 'acceptEdits' }] };
  const ok = construirRespuesta(p, { permitir: true });
  assert.deepEqual(ok.respuesta, { behavior: 'allow', updatedInput: p.input });
  assert.equal(ok.respuesta.updatedPermissions, undefined);
  const no = construirRespuesta(p, { permitir: false });
  assert.equal(no.respuesta.behavior, 'deny');
  assert.throws(() => construirRespuesta(p, { permitir: 'sí' }), /inválida/);
  assert.throws(() => construirRespuesta(p, {}), /inválida/);
});

test('permiso: «siempre» usa solo las sugerencias del propio Claude Code y se ignora si no hay', () => {
  const sug = [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }];
  const conSug = construirRespuesta({ tool: 'Write', input: {}, sugerencias: sug }, { permitir: true, siempre: true, updatedPermissions: [{ type: 'addRules', evil: true }] });
  assert.deepEqual(conSug.respuesta.updatedPermissions, sug, 'lo que mande el navegador no se reenvía');
  const sinSug = construirRespuesta({ tool: 'Write', input: {} }, { permitir: true, siempre: true });
  assert.equal(sinSug.respuesta.updatedPermissions, undefined);
});

// ---- startRun con un proceso falso
function falso() {
  const c = new EventEmitter();
  c.stdout = new PassThrough(); c.stderr = new PassThrough(); c.stdin = new PassThrough(); c.pid = 4242;
  c.escritos = [];
  c.stdin.on('data', (d) => c.escritos.push(...d.toString().split('\n').filter(Boolean).map((l) => JSON.parse(l))));
  c.kill = () => {};
  return c;
}
const tick = () => new Promise((r) => setImmediate(r));
const linea = (c, o) => c.stdout.write(typeof o === 'string' ? o + '\n' : JSON.stringify(o) + '\n');

function lanzar(extra = {}) {
  const hijo = falso();
  const eventos = [];
  let args;
  const run = startRun({ prompt: '/nuevo-cliente demo', emit: (e) => eventos.push(e), spawnFn: (bin, a) => { args = a; return hijo; }, bashLibre: false, ...extra });
  return { hijo, eventos, run, args };
}

test('startRun usa el protocolo stream-json con permisos delegados al anfitrión y manda el prompt por stdin', async () => {
  const { hijo, args } = lanzar({ sessionId: UUID });
  for (const a of ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--permission-prompt-tool', 'stdio']) assert.ok(args.includes(a), a);
  assert.deepEqual(args.slice(args.indexOf('--resume')), ['--resume', UUID]);
  assert.ok(!args.join(' ').includes('nuevo-cliente'), 'el prompt no va en los argumentos');
  await tick();
  assert.deepEqual(hijo.escritos[0], { type: 'user', message: { role: 'user', content: '/nuevo-cliente demo' } });
});

test('un can_use_tool se emite como solicitud y responder escribe el control_response correcto', async () => {
  const { hijo, eventos, run } = lanzar();
  linea(hijo, { type: 'control_request', request_id: 'req-1', request: { subtype: 'can_use_tool', tool_name: 'AskUserQuestion', input: PREGUNTAS, requires_user_interaction: true } });
  await tick();
  const sol = eventos.find((e) => e.type === 'solicitud');
  assert.equal(sol.id, 'req-1');
  assert.equal(sol.tool, 'AskUserQuestion');
  assert.deepEqual(run.pendientes(), ['req-1']);

  run.responder('req-1', { respuestas: ['A', ['X']] });
  const cr = hijo.escritos.at(-1);
  assert.equal(cr.type, 'control_response');
  assert.equal(cr.response.request_id, 'req-1');
  assert.equal(cr.response.subtype, 'success');
  assert.equal(cr.response.response.behavior, 'allow');
  assert.equal(cr.response.response.updatedInput.answers['¿A o B?'], 'A');
  assert.deepEqual(run.pendientes(), []);
  assert.equal(eventos.at(-1).type, 'solicitud_resuelta');
  assert.throws(() => run.responder('req-1', { respuestas: ['A', ['X']] }), /ya no está pendiente/, 'no se responde dos veces');
});

test('no se puede responder un id que Claude Code no emitió', () => {
  const { run, hijo } = lanzar();
  const antes = hijo.escritos.length;
  assert.throws(() => run.responder('inventado', { permitir: true }), /ya no está pendiente/);
  assert.equal(hijo.escritos.length, antes, 'no se escribe nada en stdin');
});

test('un permiso de herramienta se puede denegar', async () => {
  const { hijo, run } = lanzar();
  linea(hijo, { type: 'control_request', request_id: 'req-2', request: { subtype: 'can_use_tool', tool_name: 'Write', input: { file_path: 'x' }, permission_suggestions: [{ type: 'setMode', mode: 'acceptEdits' }] } });
  await tick();
  run.responder('req-2', { permitir: false });
  assert.equal(hijo.escritos.at(-1).response.response.behavior, 'deny');
});

test('control_cancel_request retira el pedido; los eventos normales pasan; result cierra stdin', async () => {
  const { hijo, eventos, run } = lanzar();
  linea(hijo, { type: 'control_request', request_id: 'req-3', request: { subtype: 'can_use_tool', tool_name: 'Bash', input: {} } });
  linea(hijo, { type: 'control_cancel_request', request_id: 'req-3' });
  linea(hijo, { type: 'assistant', session_id: UUID, message: { content: [] } });
  linea(hijo, 'esto no es json');
  linea(hijo, { type: 'result', is_error: false });
  await tick();
  assert.deepEqual(run.pendientes(), []);
  assert.ok(eventos.some((e) => e.type === 'solicitud_resuelta' && e.id === 'req-3'));
  assert.ok(eventos.some((e) => e.type === 'claude' && e.data.type === 'assistant'));
  assert.ok(eventos.some((e) => e.type === 'stdout' && e.text === 'esto no es json'));
  assert.equal(hijo.stdin.writableEnded, true, 'al llegar el resultado se cierra la entrada para que el proceso salga');
});

test('al cerrarse el proceso se emite done y se descartan los pedidos pendientes', async () => {
  const { hijo, eventos, run } = lanzar();
  linea(hijo, { type: 'control_request', request_id: 'req-4', request: { subtype: 'can_use_tool', tool_name: 'Write', input: {} } });
  await tick();
  hijo.emit('close', 1);
  assert.deepEqual(eventos.at(-1), { type: 'done', code: 1 });
  assert.deepEqual(run.pendientes(), []);
  assert.throws(() => run.responder('req-4', { permitir: true }), /ya no está pendiente/);
});

test('startRun rechaza un sessionId que no es UUID antes de lanzar nada', () => {
  let lanzado = false;
  const spawnFn = () => { lanzado = true; return falso(); };
  assert.throws(() => startRun({ prompt: 'x', sessionId: '../etc/passwd', emit() {}, spawnFn }), /sessionId inválido/);
  assert.equal(lanzado, false);
});

// ---- permisos automáticos
const RAIZ_T = '/agencia-test';
const pedirCtl = (hijo, id, tool, input, extra = {}) => linea(hijo, { type: 'control_request', request_id: id, request: { subtype: 'can_use_tool', tool_name: tool, input, ...extra } });

test('lo claramente seguro se concede solo: se responde allow, no hay solicitud y se avisa para auditar', async () => {
  const { hijo, eventos, run } = lanzar({ raiz: RAIZ_T, autoPermisos: true });
  pedirCtl(hijo, 'a1', 'Read', { file_path: 'clientes/demo/perfil.md' });
  pedirCtl(hijo, 'a2', 'mcp__gworkspace__list_events', {});
  await tick();
  assert.ok(!eventos.some((e) => e.type === 'solicitud'), 'no se le pregunta al operador');
  assert.deepEqual(run.pendientes(), []);
  assert.deepEqual(eventos.filter((e) => e.type === 'permiso_auto').map((e) => e.tool), ['Read', 'mcp__gworkspace__list_events']);
  const resp = hijo.escritos.filter((x) => x.type === 'control_response');
  assert.deepEqual(resp.map((x) => x.response.request_id), ['a1', 'a2']);
  assert.ok(resp.every((x) => x.response.response.behavior === 'allow'));
  assert.deepEqual(resp[0].response.response.updatedInput, { file_path: 'clientes/demo/perfil.md' });
});

test('lo que no es claramente seguro sigue llegando al operador', async () => {
  const { hijo, eventos, run } = lanzar({ raiz: RAIZ_T, autoPermisos: true });
  pedirCtl(hijo, 'b1', 'mcp__instagram__publicar_carrusel', { cliente: 'demo' });
  pedirCtl(hijo, 'b2', 'Read', { file_path: 'C:/Users/naess/.ssh/id_rsa' });
  pedirCtl(hijo, 'b3', 'Write', { file_path: '.claude/settings.json', content: 'x' });
  pedirCtl(hijo, 'b4', 'Bash', { command: 'rm -rf clientes' });
  pedirCtl(hijo, 'b5', 'AskUserQuestion', PREGUNTAS, { requires_user_interaction: true });
  await tick();
  assert.deepEqual(eventos.filter((e) => e.type === 'solicitud').map((e) => e.id), ['b1', 'b2', 'b3', 'b4', 'b5']);
  assert.deepEqual(run.pendientes(), ['b1', 'b2', 'b3', 'b4', 'b5']);
  assert.ok(!hijo.escritos.some((x) => x.type === 'control_response'), 'no se respondió nada solo');
});

test('con autoPermisos desactivado se pregunta todo, también las lecturas', async () => {
  const { hijo, eventos } = lanzar({ raiz: RAIZ_T, autoPermisos: false });
  pedirCtl(hijo, 'c1', 'Read', { file_path: 'clientes/demo/perfil.md' });
  await tick();
  assert.equal(eventos.filter((e) => e.type === 'solicitud').length, 1);
});

test('con bashLibre (predeterminado de Faro) el shell se concede solo; el resto sigue llegando al operador', async () => {
  const { hijo, eventos, run } = lanzar({ raiz: RAIZ_T, autoPermisos: true, bashLibre: true });
  pedirCtl(hijo, 's1', 'Bash', { command: 'rm -rf clientes' });
  pedirCtl(hijo, 's2', 'PowerShell', { command: 'Remove-Item -Recurse tmp' });
  pedirCtl(hijo, 's3', 'mcp__instagram__publicar_carrusel', { cliente: 'demo' });
  await tick();
  assert.deepEqual(eventos.filter((e) => e.type === 'solicitud').map((e) => e.id), ['s3']);
  assert.deepEqual(run.pendientes(), ['s3']);
  assert.equal(hijo.escritos.filter((x) => x.type === 'control_response').length, 2);
});
