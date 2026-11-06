// Ejecuta Claude Code en modo no interactivo dentro de agencia/ y emite sus eventos.
// El prompt viaja por stdin (nunca por argumentos de shell) para evitar inyección de comandos.
import { spawn, execFile } from 'node:child_process';
import { AGENCIA_ROOT, listSkills, safeSlug } from './data.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PERMISSION_MODE = process.env.FARO_PERMISSION_MODE || 'acceptEdits';
const CLAUDE_BIN = process.env.FARO_CLAUDE_BIN || 'claude';

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

/** Lanza una ejecución. Devuelve { kill() }. `emit(obj)` recibe cada evento. */
export function startRun({ prompt, sessionId, emit }) {
  if (sessionId && !UUID_RE.test(sessionId)) throw new Error('sessionId inválido');
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', PERMISSION_MODE];
  if (sessionId) args.push('--resume', sessionId);

  // shell:true es necesario en Windows (claude.cmd); los argumentos son todos fijos/validados.
  const child = spawn(CLAUDE_BIN, args, { cwd: AGENCIA_ROOT, shell: true, windowsHide: true });
  let buf = '';
  let closed = false;

  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try { emit({ type: 'claude', data: JSON.parse(line) }); }
      catch { emit({ type: 'stdout', text: line }); }
    }
  });
  child.stderr.on('data', (c) => emit({ type: 'stderr', text: c.toString('utf8') }));
  child.on('error', (e) => emit({ type: 'error', text: `No se pudo lanzar claude: ${e.message}` }));
  child.on('close', (code) => {
    closed = true;
    if (buf.trim()) emit({ type: 'stdout', text: buf.trim() });
    emit({ type: 'done', code });
  });

  child.stdin.end(prompt);

  return {
    kill() {
      if (closed) return;
      if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
      else child.kill('SIGTERM');
    },
  };
}
