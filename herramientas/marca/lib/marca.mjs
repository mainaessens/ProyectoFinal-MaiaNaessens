// Motor de marca y diseño (Claude Design con código): kit de marca por cliente, piezas HTML versionadas,
// control de marca (lint) y render a PNG con Edge/Chrome headless. Sin dependencias.
// Convención completa: docs/diseno-claude-design.md
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASE_DIR = path.resolve(here, '..', 'base');
export const AGENCIA_ROOT = process.env.AGENCIA_ROOT || path.resolve(here, '..', '..', '..');

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const PIEZA_RE = /^[a-z0-9][a-z0-9-]*$/;
const ARCHIVO_RE = /^v(\d+)\.(html|png)$|^v(\d+)-(\d+)\.png$/;
export const esSlug = (s) => typeof s === 'string' && SLUG_RE.test(s);
export const esPieza = (s) => typeof s === 'string' && PIEZA_RE.test(s);

export class MarcaError extends Error {}

// Tamaños de las piezas por clase de formato (o data-size="ANCHOxALTO").
export const FORMATOS = {
  'f-feed-1x1': [1080, 1080],
  'f-feed-4x5': [1080, 1350],
  'f-story': [1080, 1920],
  'f-wide': [1920, 1080],
};

export const rutas = (cliente, raiz = AGENCIA_ROOT) => {
  if (!esSlug(cliente)) throw new MarcaError(`Cliente inválido: ${cliente}`);
  const dir = path.join(raiz, 'clientes', cliente);
  return {
    dir,
    marca: path.join(dir, 'marca'),
    marcaJson: path.join(dir, 'marca', 'marca.json'),
    marcaCss: path.join(dir, 'marca', 'marca.css'),
    diseno: path.join(dir, 'diseno'),
    assets: path.join(dir, 'assets'),
    exports: path.join(dir, 'assets', 'exports'),
  };
};

// ---------- kit de marca ----------

export const marcaPorDefecto = (nombre) => ({
  nombre,
  tokens: {
    colores: {
      primario: '#1f4fd8', secundario: '#0b1633', acento: '#f5a524',
      fondo: '#ffffff', texto: '#0b1633', superficie: '#f3f5fa',
      fondoOscuro: '#0b1633', textoOscuro: '#ffffff',
    },
    fuentes: {
      titulo: { familia: 'Georgia', archivo: null },
      texto: { familia: 'Segoe UI', archivo: null },
    },
    radio: 16,
  },
  logo: { principal: null, inverso: null, texto: nombre },
  reglas: { sinEmojis: true, sinExclamaciones: false, prohibidas: [], logoObligatorio: true },
});

const leerJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new MarcaError(`No se pudo leer ${p}: ${e.message}`); }
};

export function leerMarca(cliente, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  if (!fs.existsSync(r.marcaJson)) throw new MarcaError(`El cliente ${cliente} no tiene kit de marca. Ejecutá: marca.mjs init ${cliente}`);
  const m = leerJson(r.marcaJson);
  const def = marcaPorDefecto(m.nombre || cliente);
  return {
    ...def, ...m,
    tokens: { ...def.tokens, ...m.tokens, colores: { ...def.tokens.colores, ...m.tokens?.colores }, fuentes: { ...def.tokens.fuentes, ...m.tokens?.fuentes } },
    logo: { ...def.logo, ...m.logo },
    reglas: { ...def.reglas, ...m.reglas },
  };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const FAMILIA_RE = /^[A-Za-z0-9 ._-]{1,60}$/;
const ARCHIVO_FUENTE_RE = /^[A-Za-z0-9 ._-]+\.(ttf|otf|woff2?)$/i;

/** CSS de la marca: variables + @font-face de los archivos de fuente del cliente. */
export function construirCss(marca) {
  const c = marca.tokens.colores;
  for (const [k, v] of Object.entries(c)) if (!HEX_RE.test(v)) throw new MarcaError(`Color inválido en tokens.colores.${k}: ${v}`);
  const f = marca.tokens.fuentes;
  const lineas = ['/* Generado por marca.mjs build desde marca.json. No editar a mano. */'];
  const stack = (def, generica) => {
    if (!FAMILIA_RE.test(def.familia)) throw new MarcaError(`Familia tipográfica inválida: ${def.familia}`);
    if (def.archivo) {
      if (!ARCHIVO_FUENTE_RE.test(def.archivo)) throw new MarcaError(`Archivo de fuente inválido: ${def.archivo}`);
      lineas.push(`@font-face { font-family: "${def.familia}"; src: url("fuentes/${def.archivo}"); font-weight: 100 900; font-display: block; }`);
    }
    return `"${def.familia}", ${generica}`;
  };
  const titulo = stack(f.titulo, 'serif');
  const texto = stack(f.texto, 'sans-serif');
  lineas.push(':root {',
    `  --c-primario: ${c.primario}; --c-secundario: ${c.secundario}; --c-acento: ${c.acento};`,
    `  --c-fondo: ${c.fondo}; --c-texto: ${c.texto}; --c-superficie: ${c.superficie};`,
    `  --c-fondo-oscuro: ${c.fondoOscuro}; --c-texto-oscuro: ${c.textoOscuro};`,
    `  --f-titulo: ${titulo}; --f-texto: ${texto};`,
    `  --radio: ${Number(marca.tokens.radio) || 0}px;`,
    '}', '');
  return lineas.join('\n');
}

export function build(cliente, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  const css = construirCss(leerMarca(cliente, ctx));
  fs.writeFileSync(r.marcaCss, css, 'utf8');
  return r.marcaCss;
}

/** Crea clientes/<c>/marca/ con marca.json de partida y su CSS. No pisa un kit existente. */
export function init(cliente, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  if (!fs.existsSync(r.dir)) throw new MarcaError(`No existe clientes/${cliente}/. Ejecutá primero /nuevo-cliente ${cliente}.`);
  if (fs.existsSync(r.marcaJson)) throw new MarcaError(`clientes/${cliente}/marca/ ya existe; editá marca.json y ejecutá build.`);
  fs.mkdirSync(path.join(r.marca, 'logo'), { recursive: true });
  fs.mkdirSync(path.join(r.marca, 'fuentes'), { recursive: true });
  fs.writeFileSync(r.marcaJson, JSON.stringify(marcaPorDefecto(cliente), null, 2) + '\n', 'utf8');
  build(cliente, ctx);
  return r.marcaJson;
}

// ---------- piezas y versiones ----------

const hoy = () => new Date().toISOString().slice(0, 10);
export const listarPlantillas = () => fs.readdirSync(path.join(BASE_DIR, 'plantillas')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();

/** Crea diseno/<fecha>-<slug>/v1.html a partir de una plantilla base. */
export function nueva(cliente, slug, plantilla, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  if (!esPieza(slug)) throw new MarcaError(`Nombre de pieza inválido: ${slug} (minúsculas, números y guiones)`);
  if (!listarPlantillas().includes(plantilla)) throw new MarcaError(`Plantilla desconocida: ${plantilla}. Disponibles: ${listarPlantillas().join(', ')}`);
  leerMarca(cliente, ctx); // exige kit de marca
  const id = /^\d{4}-\d{2}-\d{2}-/.test(slug) ? slug : `${hoy()}-${slug}`;
  const dir = path.join(r.diseno, id);
  if (fs.existsSync(dir)) throw new MarcaError(`La pieza ${id} ya existe; usá iterar.`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(BASE_DIR, 'plantillas', `${plantilla}.html`), path.join(dir, 'v1.html'));
  return { id, archivo: path.join(dir, 'v1.html') };
}

export function versiones(cliente, pieza, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  if (!esPieza(pieza)) throw new MarcaError(`Pieza inválida: ${pieza}`);
  const dir = path.join(r.diseno, pieza);
  if (!fs.existsSync(dir)) throw new MarcaError(`No existe la pieza ${pieza}`);
  const porN = new Map();
  for (const f of fs.readdirSync(dir)) {
    const m = /^v(\d+)\.html$/.exec(f);
    if (m) porN.set(Number(m[1]), { n: Number(m[1]), html: f, pngs: [] });
  }
  for (const f of fs.readdirSync(dir)) {
    const m = /^v(\d+)\.png$/.exec(f) || /^v(\d+)-\d+\.png$/.exec(f);
    if (m && porN.has(Number(m[1]))) porN.get(Number(m[1])).pngs.push(f);
  }
  const out = [...porN.values()].sort((a, b) => a.n - b.n);
  for (const v of out) { v.pngs.sort(); v.modificado = fs.statSync(path.join(dir, v.html)).mtimeMs; }
  return out;
}

/** Copia la última versión a vN+1 (sin pisar nada) para que el agente aplique cambios sobre ella. */
export function iterar(cliente, pieza, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  const vs = versiones(cliente, pieza, ctx);
  if (!vs.length) throw new MarcaError(`La pieza ${pieza} no tiene versiones.`);
  const ultima = vs[vs.length - 1];
  const nueva = `v${ultima.n + 1}.html`;
  const dir = path.join(r.diseno, pieza);
  fs.copyFileSync(path.join(dir, ultima.html), path.join(dir, nueva));
  return { n: ultima.n + 1, archivo: path.join(dir, nueva), desde: ultima.html };
}

export function listarDisenos(cliente, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  if (!fs.existsSync(r.diseno)) return [];
  const out = [];
  for (const d of fs.readdirSync(r.diseno, { withFileTypes: true })) {
    if (!d.isDirectory() || !esPieza(d.name)) continue;
    const vs = versiones(cliente, d.name, ctx);
    let notas = '';
    try { notas = fs.readFileSync(path.join(r.diseno, d.name, 'notas.md'), 'utf8'); } catch { /* sin notas */ }
    let aprobada = null;
    try { aprobada = JSON.parse(fs.readFileSync(path.join(r.diseno, d.name, 'aprobada.json'), 'utf8')); } catch { /* sin aprobar */ }
    out.push({ id: d.name, versiones: vs, notas, aprobada });
  }
  return out.sort((a, b) => b.id.localeCompare(a.id));
}

// ---------- lint ----------

const quitarTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2B50}\u{2705}\u{274C}]/u;
const GENERICAS = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', 'inherit', 'initial', 'cursive', 'ui-sans-serif', 'var']);

const norm6 = (h) => { h = h.toLowerCase(); return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h; };

const textoVisible = (html) => html
  .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

/** Control de marca de un HTML. Devuelve hallazgos { nivel: 'error'|'aviso', regla, mensaje }. */
export function lintHtml(html, marca) {
  const h = [];
  const add = (nivel, regla, mensaje) => h.push({ nivel, regla, mensaje });
  const reglas = marca.reglas;
  const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, ' ');

  if (!/class="[^"]*(?<![\w-])piece(?![\w-])/.test(sinComentarios)) add('error', 'piece', 'No hay ningún elemento con clase "piece": no se puede renderizar.');

  const texto = textoVisible(html);
  if (reglas.sinEmojis !== false && EMOJI_RE.test(texto)) add('error', 'emojis', 'El texto de la pieza tiene emojis y la marca no los usa.');
  if (reglas.sinExclamaciones === true && /[!¡]/.test(texto)) add('error', 'exclamaciones', 'La marca no usa signos de exclamación.');
  const plano = quitarTildes(texto);
  for (const p of reglas.prohibidas || []) {
    if (p && plano.includes(quitarTildes(String(p)))) add('error', 'prohibidas', `Palabra o frase prohibida por el perfil: "${p}".`);
  }
  if (/\blorem\b|\bxxx+\b|\{\{(?!\s*(BASE|MARCA|ASSETS))/i.test(texto) || /\bTODO\b/.test(texto)) add('error', 'relleno', 'Quedó texto de relleno (Lorem, XXX, TODO o {{…}}).');

  const permitidos = new Set(Object.values(marca.tokens.colores).map(norm6));
  permitidos.add('#ffffff');
  const estilos = [...sinComentarios.matchAll(/<style[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n') + '\n' + [...sinComentarios.matchAll(/style="([^"]*)"/gi)].map((m) => m[1]).join('\n');
  const fuera = new Set();
  for (const m of estilos.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    if (![4, 7].includes(m[0].length)) continue;
    const c = norm6(m[0]);
    if (!permitidos.has(c)) fuera.add(c);
  }
  if (fuera.size) add('aviso', 'colores', `Colores fuera de la paleta de la marca: ${[...fuera].join(', ')}. Usá las variables var(--c-*).`);
  if (/#000(000)?\b/i.test(estilos) && reglas.sinNegroPuro !== false) add('aviso', 'negro', 'Negro puro (#000): usá el color de texto de la marca.');

  const fuentesOk = new Set([marca.tokens.fuentes.titulo.familia, marca.tokens.fuentes.texto.familia].map((x) => x.toLowerCase()));
  const noPermitidas = new Set();
  for (const m of estilos.matchAll(/font-family\s*:\s*([^;}"]+)/gi)) {
    for (const parte of m[1].split(',')) {
      const nombre = parte.trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (!nombre || GENERICAS.has(nombre) || nombre.startsWith('var(')) continue;
      if (!fuentesOk.has(nombre)) noPermitidas.add(nombre);
    }
  }
  if (noPermitidas.size) add('aviso', 'fuentes', `Tipografías fuera de la marca: ${[...noPermitidas].join(', ')}.`);

  if (reglas.logoObligatorio !== false && !/class="[^"]*\b(logo|wordmark)\b/.test(sinComentarios)) add('aviso', 'logo', 'La pieza no lleva el logo de la marca (clase "logo" o "wordmark").');
  return h;
}

export function lint(cliente, pieza, version, ctx = {}) {
  const marca = leerMarca(cliente, ctx);
  const r = rutas(cliente, ctx.raiz);
  const vs = versiones(cliente, pieza, ctx);
  const v = version ? vs.find((x) => x.n === Number(version)) : vs[vs.length - 1];
  if (!v) throw new MarcaError(`No existe la versión ${version} de ${pieza}`);
  return { version: v.n, hallazgos: lintHtml(fs.readFileSync(path.join(r.diseno, pieza, v.html), 'utf8'), marca) };
}

// ---------- render ----------

export function encontrarNavegador(env = process.env, existe = fs.existsSync) {
  const candidatos = [
    env.MARCA_NAVEGADOR,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  return candidatos.find((c) => existe(c)) || null;
}

/** Piezas (.piece) de un HTML con su tamaño en px. */
export function piezasDeHtml(html) {
  const out = [];
  for (const m of html.matchAll(/<[a-z0-9]+\b[^>]*\bclass="([^"]*(?<![\w-])piece(?![\w-])[^"]*)"[^>]*>/gi)) {
    const tag = m[0];
    const size = /data-size="(\d{3,4})x(\d{3,4})"/.exec(tag);
    let wh = size ? [Number(size[1]), Number(size[2])] : null;
    if (!wh) { const f = m[1].split(/\s+/).find((c) => FORMATOS[c]); wh = f ? FORMATOS[f] : null; }
    out.push({ ancho: wh?.[0] ?? 1080, alto: wh?.[1] ?? 1080 });
  }
  return out;
}

const urlDir = (p) => pathToFileURL(p).href.replace(/\/$/, '');

const ejecutar = (bin, args, timeout = 90000) => new Promise((resolve, reject) => {
  execFile(bin, args, { timeout, windowsHide: true }, (err, _so, se) => (err ? reject(new MarcaError(`El navegador falló: ${err.message}\n${se || ''}`.trim())) : resolve()));
});

/**
 * Renderiza una versión a PNG junto al HTML (vN.png, o vN-01.png… si hay varias piezas). Devuelve los archivos.
 * Resuelve {{BASE}}, {{MARCA}} y {{ASSETS}} en un HTML temporal al lado del original (rutas relativas intactas).
 */
export async function render(cliente, pieza, version, { escala = 1, ctx = {}, navegador } = {}) {
  const r = rutas(cliente, ctx.raiz);
  const vs = versiones(cliente, pieza, ctx);
  const v = version ? vs.find((x) => x.n === Number(version)) : vs[vs.length - 1];
  if (!v) throw new MarcaError(`No existe la versión ${version} de ${pieza}`);
  const bin = navegador || encontrarNavegador();
  if (!bin) throw new MarcaError('No se encontró Edge ni Chrome. Instalá uno o definí MARCA_NAVEGADOR con la ruta del ejecutable.');
  build(cliente, ctx); // el CSS de la marca siempre al día con marca.json
  const dir = path.join(r.diseno, pieza);
  const html = fs.readFileSync(path.join(dir, v.html), 'utf8');
  const piezas = piezasDeHtml(html);
  if (!piezas.length) throw new MarcaError('El HTML no tiene elementos con clase "piece".');
  const resuelto = html
    .replaceAll('{{BASE}}', urlDir(BASE_DIR)).replaceAll('{{MARCA}}', urlDir(r.marca)).replaceAll('{{ASSETS}}', urlDir(r.assets));
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'marca-nav-'));
  const archivos = [];
  try {
    for (let i = 0; i < piezas.length; i++) {
      const sel = `<style>html,body{margin:0;background:#fff}</style><script>document.querySelectorAll('.piece').forEach(function(p,i){if(i!==${i})p.style.display='none'})</script>`;
      const tmp = path.join(dir, `.render-${v.n}-${i}.html`);
      fs.writeFileSync(tmp, resuelto.replace(/<\/body>/i, `${sel}</body>`).replace(/<\/head>/i, '<style>html,body{margin:0}</style></head>'), 'utf8');
      const nombre = piezas.length === 1 ? `v${v.n}.png` : `v${v.n}-${String(i + 1).padStart(2, '0')}.png`;
      const salida = path.join(dir, nombre);
      try {
        await ejecutar(bin, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--allow-file-access-from-files',
          `--user-data-dir=${perfil}`, `--force-device-scale-factor=${escala}`, '--virtual-time-budget=6000',
          `--window-size=${piezas[i].ancho},${piezas[i].alto}`, `--screenshot=${salida}`, pathToFileURL(tmp).href]);
      } finally { fs.rmSync(tmp, { force: true }); }
      if (!fs.existsSync(salida)) throw new MarcaError(`El navegador no generó ${nombre}`);
      archivos.push(salida);
    }
  } finally { fs.rmSync(perfil, { recursive: true, force: true }); }
  return archivos;
}

/** Copia los PNG de una versión a assets/exports/<pieza>[-NN].png (lo que se publica). */
export function exportar(cliente, pieza, version, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  const vs = versiones(cliente, pieza, ctx);
  const v = version ? vs.find((x) => x.n === Number(version)) : vs[vs.length - 1];
  if (!v) throw new MarcaError(`No existe la versión ${version} de ${pieza}`);
  if (!v.pngs.length) throw new MarcaError(`La versión v${v.n} no está renderizada: ejecutá render primero.`);
  fs.mkdirSync(r.exports, { recursive: true });
  return v.pngs.map((f, i) => {
    const destino = path.join(r.exports, v.pngs.length === 1 ? `${pieza}.png` : `${pieza}-${String(i + 1).padStart(2, '0')}.png`);
    fs.copyFileSync(path.join(r.diseno, pieza, f), destino);
    return destino;
  });
}

/** El humano aprueba una versión: se exportan sus PNG a assets/exports/ y se deja constancia en aprobada.json. */
export function aprobar(cliente, pieza, version, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  const vs = versiones(cliente, pieza, ctx);
  const v = vs.find((x) => x.n === Number(version));
  if (!v) throw new MarcaError(`No existe la versión ${version} de ${pieza}`);
  const archivos = exportar(cliente, pieza, v.n, ctx).map((f) => path.relative(r.dir, f).replace(/\\/g, '/'));
  const registro = { version: v.n, fecha: new Date().toISOString(), por: ctx.por || 'cli', archivos };
  fs.writeFileSync(path.join(r.diseno, pieza, 'aprobada.json'), JSON.stringify(registro, null, 2) + '\n', 'utf8');
  return registro;
}

/** Ruta absoluta de un archivo de una pieza para servirlo (solo vN.html / vN.png / vN-NN.png). */
export function archivoDePieza(cliente, pieza, archivo, ctx = {}) {
  const r = rutas(cliente, ctx.raiz);
  if (!esPieza(pieza) || typeof archivo !== 'string' || !ARCHIVO_RE.test(archivo)) return null;
  const p = path.join(r.diseno, pieza, archivo);
  return fs.existsSync(p) ? p : null;
}
