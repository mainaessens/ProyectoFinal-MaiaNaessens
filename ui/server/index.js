import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { listClientes, getCliente, decidirPlan, listSkills, safeSlug, safePlanFile, AGENCIA_ROOT } from './data.js';
import { buildPrompt, startRun } from './runner.js';
import { manejarConexion } from './conexion.js';
import { crearAlmacen, esIdValido } from './sesiones.js';
import { listarVideos, archivoDeVideo, listarImagenes } from './videos.js';
import { listarModelos, modeloPorDefecto } from './modelos.js';
import { cargarEnv } from '../../lib/cargar-env.mjs';
import { listarDisenos, archivoDePieza, aprobar, esPieza, MarcaError } from '../../herramientas/marca/lib/marca.mjs';

cargarEnv(); // carga variables desde .claude/.env (el .env pisa el entorno del sistema)

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.FARO_PORT || 4310);
const HOST = '127.0.0.1'; // solo local: el panel puede ejecutar el agente
// El token se guarda en ui/.faro-token para que no cambie en cada reinicio.
const tokenFile = path.join(here, '..', '.faro-token');
const loadToken = () => {
  if (process.env.FARO_TOKEN) return process.env.FARO_TOKEN;
  try { const t = fs.readFileSync(tokenFile, 'utf8').trim(); if (t) return t; } catch {}
  const t = crypto.randomBytes(18).toString('base64url');
  fs.writeFileSync(tokenFile, t, { mode: 0o600 });
  return t;
};
const TOKEN = loadToken();

const tokenOk = (t) => {
  if (typeof t !== 'string') return false;
  const a = Buffer.from(t), b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const app = express();
app.use(express.json({ limit: '50kb' }));

app.use('/api', (req, res, next) => {
  const h = req.headers.authorization || '';
  if (tokenOk(h.replace(/^Bearer\s+/i, ''))) return next();
  res.status(401).json({ error: 'Token inválido' });
});

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

app.get('/api/clientes', wrap(async (_q, res) => res.json(await listClientes())));

app.get('/api/clientes/:slug', wrap(async (req, res) => {
  const slug = safeSlug(req.params.slug);
  const c = slug && (await getCliente(slug));
  c ? res.json(c) : res.status(404).json({ error: 'Cliente no encontrado' });
}));

app.post('/api/clientes/:slug/planes/:archivo/decision', wrap(async (req, res) => {
  const slug = safeSlug(req.params.slug);
  const archivo = safePlanFile(req.params.archivo);
  if (!slug || !archivo || typeof req.body?.aprobado !== 'boolean') {
    return res.status(400).json({ error: 'Solicitud inválida' });
  }
  res.json(await decidirPlan(slug, archivo, req.body.aprobado));
}));

// Diseños con Claude Design (clientes/<c>/diseno/<pieza>/vN.html + vN.png). Ver docs/diseno-claude-design.md.
app.get('/api/clientes/:slug/disenos', wrap(async (req, res) => {
  const slug = safeSlug(req.params.slug);
  if (!slug) return res.status(400).json({ error: 'Cliente inválido' });
  res.json(listarDisenos(slug));
}));

// Solo sirve vN.png / vN-NN.png / vN.html de la pieza. El HTML va como texto plano (nunca se ejecuta en el panel).
app.get('/api/clientes/:slug/disenos/:pieza/:archivo', (req, res) => {
  const slug = safeSlug(req.params.slug);
  const file = slug && archivoDePieza(slug, req.params.pieza, req.params.archivo);
  if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  res.type(file.endsWith('.png') ? 'image/png' : 'text/plain; charset=utf-8');
  res.sendFile(file);
});

// Aprobar una versión: exporta sus PNG a assets/exports/ y deja constancia (acción humana, como aprobar un plan).
app.post('/api/clientes/:slug/disenos/:pieza/aprobar', wrap(async (req, res) => {
  const slug = safeSlug(req.params.slug);
  const version = Number(req.body?.version);
  if (!slug || !esPieza(req.params.pieza) || !Number.isInteger(version) || version < 1) return res.status(400).json({ error: 'Solicitud inválida' });
  try {
    const r = aprobar(slug, req.params.pieza, version, { por: 'faro-ui' });
    const hoy = new Date().toISOString().slice(0, 10);
    await fs.promises.appendFile(path.join(AGENCIA_ROOT, 'clientes', slug, 'registro-actividad.log'),
      `[${hoy}] Postagent UI: diseño ${req.params.pieza} v${version} APROBADO y exportado por el operador.\n`, 'utf8');
    res.json(r);
  } catch (e) {
    if (e instanceof MarcaError) return res.status(400).json({ error: e.message });
    throw e;
  }
}));

// Videos editados con Moviola: planes por escena y mp4 terminados (solo lectura).
app.get('/api/clientes/:slug/videos', wrap(async (req, res) => {
  const slug = safeSlug(req.params.slug);
  if (!slug) return res.status(400).json({ error: 'Cliente inválido' });
  res.json(await listarVideos(slug));
}));
app.get('/api/clientes/:slug/imagenes', wrap(async (req, res) => {
  const slug = safeSlug(req.params.slug);
  if (!slug) return res.status(400).json({ error: 'Cliente inválido' });
  res.json(await listarImagenes(slug));
}));
app.get('/api/clientes/:slug/videos/:archivo', (req, res) => {
  const slug = safeSlug(req.params.slug);
  const file = slug && archivoDeVideo(slug, req.params.archivo);
  if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  res.type('video/mp4');
  res.sendFile(file, (e) => { if (e && !res.headersSent) res.status(404).json({ error: 'Archivo no encontrado' }); });
});

app.get('/api/modelos', (_q, res) => res.json({ modelos: listarModelos(), porDefecto: modeloPorDefecto() }));

app.get('/api/skills', wrap(async (_q, res) => res.json(await listSkills())));

// Sesiones guardadas del agente (historial para poder continuarlas). Datos locales: no se versionan.
const almacen = crearAlmacen({ dir: process.env.FARO_DATA_DIR ? path.resolve(process.env.FARO_DATA_DIR) : path.join(here, '..', '.faro-data', 'sesiones') });

app.get('/api/sesiones', wrap(async (req, res) => {
  const c = req.query.cliente;
  if (c !== undefined && c !== '' && !safeSlug(c)) return res.status(400).json({ error: 'Cliente inválido' });
  res.json(await almacen.listar(c === undefined ? {} : { cliente: c }));
}));
app.get('/api/sesiones/:id', wrap(async (req, res) => {
  if (!esIdValido(req.params.id)) return res.status(400).json({ error: 'Id inválido' });
  const s = await almacen.leer(req.params.id);
  s ? res.json(s) : res.status(404).json({ error: 'Sesión no encontrada' });
}));
app.delete('/api/sesiones/:id', wrap(async (req, res) => {
  if (!esIdValido(req.params.id)) return res.status(400).json({ error: 'Id inválido' });
  await almacen.borrar(req.params.id);
  res.json({ ok: true });
}));

// Frontend compilado (npm run build). En desarrollo lo sirve Vite.
const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_q, res) => res.sendFile(path.join(dist, 'index.html')));
}

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const originOk = !req.headers.origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin);
  if (url.pathname !== '/ws' || !originOk || !tokenOk(url.searchParams.get('token'))) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (ws) => {
  // Una ejecución a la vez por conexión. Solo se cancela con `cancel` o al cerrarse la conexión
  // (cerrar o recargar la pestaña). Ver conexion.js.
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  const conexion = manejarConexion({ send, buildPrompt, startRun, almacen });
  ws.on('message', (raw) => conexion.onMessage(raw));
  ws.on('close', () => conexion.onClose());
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Postagent listo → http://localhost:${PORT}/?token=${TOKEN}`);
  console.log(`  Agencia: ${AGENCIA_ROOT}\n`);
});

export { app, TOKEN };
