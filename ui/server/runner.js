// Ejecuta Claude Code en modo no interactivo dentro de agencia/ y emite sus eventos.
//
// Protocolo (el mismo que usa el SDK): entrada y salida stream-json y `--permission-prompt-tool stdio`.
// Con eso Claude Code NO decide solo los permisos ni las preguntas: manda un `control_request` (subtype
// can_use_tool) y espera nuestro `control_response`. Postagent los muestra en el panel y reenvía la decisión del
// operador. Cubre dos casos: AskUserQuestion (pregunta con opciones) y permiso para usar una herramienta.
//
// Seguridad: el prompt viaja por stdin (nunca por argumentos de shell); solo se aceptan respuestas a pedidos
// que el propio Claude Code emitió (se recuerdan por id); las opciones se validan contra las preguntas hechas.
import { spawn as spawnReal, execFile } from 'node:child_process';
import { AGENCIA_ROOT, listSkills, safeSlug } from './data.js';
import { validarModelo, modeloPorDefecto } from './modelos.js';
import { decidirAutomatico } from './politica.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PERMISSION_MODE = process.env.FARO_PERMISSION_MODE || 'acceptEdits';
const CLAUDE_BIN = process.env.FARO_CLAUDE_BIN || 'claude';
const MAX_RESPUESTA = 500;
// Permisos automáticos: lo claramente seguro se concede solo (ver politica.js). FARO_PERMISOS_AUTO=off pregunta todo.
const AUTO_ACTIVA = (process.env.FARO_PERMISOS_AUTO || 'seguros').toLowerCase() !== 'off';
// Shell (Bash y PowerShell): se permite todo salvo FARO_BASH=preguntar, que vuelve a pedir lo que no sea de solo lectura.
const BASH_LIBRE = (process.env.FARO_BASH || 'todo').toLowerCase() !== 'preguntar';

export async function buildPrompt({ skill, cliente, args, text }) {
  if (text) {
    if (typeof text !== 'string' || text.length > 4000) throw new Error('Mensaje inválido');
    return text;
  }
  const skills = await listSkills();
  if (!skills.some((s) => s.name === skill)) throw new Error(`Skill desconocido: ${skill}`);
  if (cliente && !safeSlug(cliente)) throw new Error('Cliente inválido');
  const extra = typeof args === 'string' ? args.replace(/[\r\n]+/g, ' ').trim() : '';
  if (extra.length > 500) throw new Error('Argumentos demasiado largos');
  return `/${skill} ${[cliente, extra].filter(Boolean).join(' ')}`.trim();
}

const texto = (v, nombre) => {
  if (typeof v !== 'string' || !v.trim() || v.length > MAX_RESPUESTA) throw new Error(`Respuesta inválida (${nombre})`);
  return v.trim();
};

/**
 * Arma la respuesta a un pedido a partir de la decisión del operador. Función pura (se prueba sola).
 *  - AskUserQuestion: decision = { respuestas: [string | string[]] } (una por pregunta, en orden) o { cancelar: true }.
 *  - Permiso de herramienta: decision = { permitir: boolean, siempre?: boolean }.
 * Devuelve { respuesta, resumen } o lanza Error si la decisión no es válida.
 */
export function construirRespuesta(pedido, decision) {
  if (!decision || typeof decision !== 'object') throw new Error('Respuesta inválida');
  if (pedido.tool === 'AskUserQuestion') {
    if (decision.cancelar === true) {
      return { respuesta: { behavior: 'deny', message: 'El operador canceló la pregunta desde Postagent.' }, resumen: 'Cancelaste la pregunta del agente.' };
    }
    const preguntas = Array.isArray(pedido.input?.questions) ? pedido.input.questions : [];
    const r = decision.respuestas;
    if (!Array.isArray(r) || r.length !== preguntas.length || preguntas.length === 0) throw new Error('Respuesta inválida (cantidad de respuestas)');
    const answers = {};
    const partes = [];
    preguntas.forEach((q, i) => {
      const v = Array.isArray(r[i]) ? r[i].map((x) => texto(x, q.question)).join(', ') : texto(r[i], q.question);
      if (Array.isArray(r[i]) && !q.multiSelect) throw new Error('Respuesta inválida (selección múltiple no permitida)');
      answers[q.question] = v;
      partes.push(v);
    });
    return { respuesta: { behavior: 'allow', updatedInput: { ...pedido.input, answers } }, resumen: `Respondiste: ${partes.join(' · ')}` };
  }
  if (typeof decision.permitir !== 'boolean') throw new Error('Respuesta inválida (permitir)');
  if (!decision.permitir) {
    return { respuesta: { behavior: 'deny', message: 'El operador denegó este pedido desde Postagent.' }, resumen: `Denegaste el permiso para ${pedido.tool}.` };
  }
  const respuesta = { behavior: 'allow', updatedInput: pedido.input };
  const siempre = decision.siempre === true && Array.isArray(pedido.sugerencias) && pedido.sugerencias.length > 0;
  if (siempre) respuesta.updatedPermissions = pedido.sugerencias; // sugerencias del propio Claude Code, nunca del cliente
  return { respuesta, resumen: `Permitiste ${pedido.tool}${siempre ? ' (siempre en esta sesión)' : ''}.` };
}

/** Argumentos de `claude` para una ejecución (puro: se prueba solo). `modelo` debe estar en la lista permitida. */
export function argsDeClaude({ sessionId, modelo, env = process.env } = {}) {
  if (sessionId && !UUID_RE.test(sessionId)) throw new Error('sessionId inválido');
  const elegido = validarModelo(modelo, env) ?? (modeloPorDefecto(env) || null);
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
    '--permission-prompt-tool', 'stdio', '--permission-mode', PERMISSION_MODE];
  if (elegido) args.push('--model', elegido);
  if (sessionId) args.push('--resume', sessionId);
  return args;
}

/** Lanza una ejecución. Devuelve { kill(), responder(id, decision) }. `emit(obj)` recibe cada evento. */
export function startRun({ prompt, sessionId, modelo, emit, spawnFn = spawnReal, raiz = AGENCIA_ROOT, autoPermisos = AUTO_ACTIVA, bashLibre = BASH_LIBRE }) {
  const args = argsDeClaude({ sessionId, modelo });

  // shell:true es necesario en Windows (claude.cmd); los argumentos son todos fijos/validados.
  const child = spawnFn(CLAUDE_BIN, args, { cwd: AGENCIA_ROOT, shell: true, windowsHide: true });
  const pendientes = new Map();
  let buf = '';
  let closed = false;

  const escribir = (o) => { if (!closed && child.stdin?.writable) child.stdin.write(JSON.stringify(o) + '\n'); };
  child.stdin?.on?.('error', () => {}); // EPIPE si el proceso ya terminó

  const procesar = (m) => {
    if (m.type === 'control_request' && m.request?.subtype === 'can_use_tool' && typeof m.request_id === 'string') {
      const r = m.request;
      // Lo claramente seguro se concede solo: no se le pide al operador algo que el agente puede resolver por su cuenta.
      const auto = decidirAutomatico({ tool: String(r.tool_name || ''), input: r.input ?? {}, interactivo: r.requires_user_interaction === true }, { raiz, activa: autoPermisos, bashLibre });
      if (auto) {
        escribir({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: { behavior: 'allow', updatedInput: r.input ?? {} } } });
        emit({ type: 'permiso_auto', tool: String(r.tool_name || ''), motivo: auto.motivo });
        return;
      }
      pendientes.set(m.request_id, { tool: String(r.tool_name || ''), input: r.input ?? {}, sugerencias: r.permission_suggestions });
      emit({
        type: 'solicitud', id: m.request_id, tool: String(r.tool_name || ''), input: r.input ?? {},
        descripcion: typeof r.description === 'string' ? r.description : '',
        puedeSiempre: Array.isArray(r.permission_suggestions) && r.permission_suggestions.length > 0,
      });
      return;
    }
    if (m.type === 'control_cancel_request') {
      if (pendientes.delete(m.request_id)) emit({ type: 'solicitud_resuelta', id: m.request_id });
      return;
    }
    if (m.type === 'control_response') return;
    emit({ type: 'claude', data: m });
    if (m.type === 'result') child.stdin?.end?.(); // fin de la conversación: el proceso sale solo
  };

  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let m;
      try { m = JSON.parse(line); } catch { emit({ type: 'stdout', text: line }); continue; }
      procesar(m);
    }
  });
  child.stderr.on('data', (c) => emit({ type: 'stderr', text: c.toString('utf8') }));
  child.on('error', (e) => emit({ type: 'error', text: `No se pudo lanzar claude: ${e.message}` }));
  child.on('close', (code) => {
    closed = true;
    pendientes.clear();
    if (buf.trim()) emit({ type: 'stdout', text: buf.trim() });
    emit({ type: 'done', code });
  });

  escribir({ type: 'user', message: { role: 'user', content: prompt } });

  return {
    kill() {
      if (closed) return;
      if (process.platform === 'win32' && child.pid) execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
      else child.kill?.('SIGTERM');
    },
    responder(id, decision) {
      const pedido = pendientes.get(id);
      if (!pedido) throw new Error('El pedido ya no está pendiente.');
      const { respuesta, resumen } = construirRespuesta(pedido, decision);
      escribir({ type: 'control_response', response: { subtype: 'success', request_id: id, response: respuesta } });
      pendientes.delete(id);
      emit({ type: 'solicitud_resuelta', id, resumen });
    },
    pendientes: () => [...pendientes.keys()],
  };
}
