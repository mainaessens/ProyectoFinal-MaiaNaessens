// Política de permisos de Faro: qué pedidos de herramientas se conceden solos y cuáles le llegan al operador.
//
// Criterio: se aprueba automáticamente SOLO lo que no tiene efecto fuera del proyecto ni gasta dinero (lecturas dentro
// del proyecto, búsquedas, escritura dentro de clientes/**, y unos pocos comandos de solo lectura). Todo lo demás
// (publicar, crear o modificar en Drive/Calendar/Jira/Canva, generar imágenes de pago, comandos arbitrarios,
// leer o escribir fuera del proyecto, tocar .claude/**) se le muestra al operador. Ante la duda, se pregunta.
//
// Lo concedido solo queda auditado en el historial (conteo por herramienta) y los hooks de .claude/hooks/ siguen
// actuando igual: esta política no los reemplaza.
import path from 'node:path';

// Herramientas internas del propio agente (no tocan archivos ni servicios externos).
const INTERNAS = new Set(['WebSearch', 'ToolSearch', 'Skill', 'Agent', 'Task', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet']);

// Lecturas de archivos: solo dentro del proyecto (la ruta puede faltar: entonces se usa la carpeta de trabajo).
// [campo con la ruta, ¿es obligatoria?]
const LECTURA_ARCHIVOS = { Read: ['file_path', true], NotebookRead: ['notebook_path', true], Glob: ['path', false], Grep: ['path', false] };

// Herramientas que escriben archivos: solo se conceden dentro de clientes/**.
const ESCRITURA = { Write: 'file_path', Edit: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };

// Estadísticas de Instagram: de solo lectura (ver mcp/instagram-publisher/insights.mjs). publicar_* y subir_* NO.
const INSTAGRAM_LECTURA = new Set(['ver_cuenta', 'perfil_cuenta', 'listar_publicaciones', 'insights_publicacion',
  'insights_cuenta', 'audiencia', 'benchmark_competidor', 'recopilar_estadisticas']);

// Conectores que nunca se aprueban solos (publican o consumen créditos), ni siquiera sus lecturas.
const SERVIDORES_SIEMPRE_PREGUNTAR = new Set(['glif']);

// Nombre de herramienta de lectura: get_x, list_x, getJiraIssue, search-designs, read_file_content…
const LECTURA_RE = /^(get|list|read|search|lookup|describe|find|query|view)([_-]|[A-Z]|$)/;

// Comandos de solo lectura. Sin metacaracteres de shell: nada de ; & > < ` $ ( ) { } ni saltos de línea.
const META_RE = /[;&><`$(){}\r\n]/;
const BASH_LECTURA = /^(ls|pwd|cat|head|tail|wc|grep|sort|uniq|echo)(\s|$)/;
const GIT_LECTURA = /^git(\s+-C\s+\S+)?\s+(status|log|diff|ls-files|show|branch|rev-parse)(\s|$)/;
// Motor de diseño (herramientas/marca): solo escribe dentro de clientes/<c>/ y renderiza con Edge/Chrome local.
const MARCA = /^node\s+herramientas\/marca\/marca\.mjs\s+(init|build|plantillas|nueva|iterar|listar|lint|render|exportar)(\s|$)/;
const MOVIOLA = /^node\s+herramientas\/moviola\/moviola\.mjs\s+(doctor|preparar|sondear|silencios|transcribir|validar|fotograma|renderizar)(\s|$)/;
const PS_LECTURA = /^(Get-ChildItem|Get-Content|Test-Path|Get-Item|Resolve-Path|Select-String|Get-Location|Select-Object|Where-Object|Sort-Object|Measure-Object|Format-Table|Out-String)(\s|$)/i;
const ARGS_SEGUROS = /^[A-Za-z0-9_./:\\ @=,\-"'*]*$/; // argumentos sin nada que ejecute o redirija

const partes = (cmd) => cmd.split('|').map((s) => s.trim());

// Archivos que nunca se leen solos: credenciales, tokens, claves.
const SENSIBLE_RE = /(^|[\\/])(\.env[^\\/]*|\.faro-token|id_rsa[^\\/]*|[^\\/]*\.(pem|key|pfx)|[^\\/]*(credential|secret|token)s?[^\\/]*|\.git[\\/]config)$/i;

/** Convierte /c/Users/x (estilo Git Bash) a C:/Users/x para poder compararla en Windows. */
const aEstiloWindows = (p) => (process.platform === 'win32' ? p.replace(/^\/([a-zA-Z])\/(.*)$/, '$1:/$2') : p);

/** ¿`ruta` está dentro de la raíz del proyecto y no es un archivo sensible? Cualquier duda devuelve false. */
export function rutaSegura(ruta, raiz) {
  if (typeof ruta !== 'string' || !ruta || ruta.includes('\u0000')) return false;
  const abs = path.resolve(raiz, aEstiloWindows(ruta));
  const rel = path.relative(path.resolve(raiz), abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return !SENSIBLE_RE.test(abs);
}

/** Argumentos de un comando: sin `..`, sin archivos sensibles y las rutas (absolutas o con separadores) dentro del proyecto. */
function argumentosEnProyecto(cmd, raiz) {
  const tokens = cmd.split(/\s+/).map((x) => x.replace(/^["']|["']$/g, '')).filter(Boolean);
  for (const tk of tokens) {
    if (tk.startsWith('-')) continue;
    if (tk === '..' || tk.split(/[\\/]/).includes('..')) return false;
    if (SENSIBLE_RE.test(tk)) return false;
    if (/[\\/:]/.test(tk) && !/^https?:/i.test(tk) && !rutaSegura(tk, raiz)) return false;
  }
  return true;
}

function bashSeguro(cmd, raiz) {
  if (typeof cmd !== 'string' || !cmd.trim() || cmd.length > 400 || META_RE.test(cmd)) return false;
  const c = cmd.trim();
  if (MARCA.test(c)) return !c.includes('|') && ARGS_SEGUROS.test(c) && argumentosEnProyecto(c, raiz);
  if (MOVIOLA.test(c)) return !c.includes('|') && ARGS_SEGUROS.test(c) && argumentosEnProyecto(c, raiz);
  return partes(c).every((p) => (BASH_LECTURA.test(p) || GIT_LECTURA.test(p)) && ARGS_SEGUROS.test(p) && argumentosEnProyecto(p, raiz));
}

function powershellSeguro(cmd, raiz) {
  if (typeof cmd !== 'string' || !cmd.trim() || cmd.length > 400 || META_RE.test(cmd.replace(/\|/g, ' '))) return false;
  return partes(cmd).every((p) => PS_LECTURA.test(p) && ARGS_SEGUROS.test(p) && argumentosEnProyecto(p, raiz));
}

/** ¿`ruta` está dentro de <raiz>/clientes? Cualquier duda (ruta relativa rara, otra unidad, `..`) devuelve false. */
export function dentroDeClientes(ruta, raiz) {
  if (typeof ruta !== 'string' || !ruta || ruta.includes('\u0000')) return false;
  const base = path.resolve(raiz, 'clientes');
  const abs = path.resolve(raiz, aEstiloWindows(ruta));
  const rel = path.relative(base, abs);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Decide si un pedido se concede solo. Devuelve { motivo } si sí, o null si hay que preguntarle al operador.
 * `pedido` = { tool, input, interactivo }.
 */
export function decidirAutomatico(pedido, { raiz, activa = true, bashLibre = false } = {}) {
  if (!activa || !pedido || typeof pedido.tool !== 'string') return null;
  const { tool, input } = pedido;
  if (pedido.interactivo) return null; // una pregunta al operador nunca se contesta sola

  if (INTERNAS.has(tool)) return { motivo: 'interna' };

  if (LECTURA_ARCHIVOS[tool]) {
    const [campo, obligatorio] = LECTURA_ARCHIVOS[tool];
    const ruta = input?.[campo];
    if (ruta === undefined || ruta === null || ruta === '') return obligatorio ? null : { motivo: 'lectura en el proyecto' };
    return rutaSegura(ruta, raiz) ? { motivo: 'lectura en el proyecto' } : null;
  }

  if (ESCRITURA[tool]) {
    return dentroDeClientes(input?.[ESCRITURA[tool]], raiz) ? { motivo: 'escritura en clientes/' } : null;
  }
  // Con bashLibre (FARO_BASH=todo, el predeterminado de Faro) cualquier comando de shell se concede solo.
  if ((tool === 'Bash' || tool === 'PowerShell') && bashLibre) return { motivo: 'shell permitido (FARO_BASH)' };
  if (tool === 'Bash') return bashSeguro(input?.command, raiz) ? { motivo: 'comando de solo lectura' } : null;
  if (tool === 'PowerShell') return powershellSeguro(input?.command, raiz) ? { motivo: 'comando de solo lectura' } : null;

  const m = /^mcp__(.+?)__(.+)$/.exec(tool);
  if (m) {
    const [, servidor, nombre] = m;
    if (SERVIDORES_SIEMPRE_PREGUNTAR.has(servidor)) return null;
    if (servidor === 'instagram') return INSTAGRAM_LECTURA.has(nombre) ? { motivo: 'estadística de solo lectura' } : null;
    return LECTURA_RE.test(nombre) ? { motivo: 'lectura de un conector' } : null;
  }
  return null;
}
