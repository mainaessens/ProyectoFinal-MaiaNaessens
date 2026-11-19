// Videos editados con Moviola (clientes/<c>/assets/edicion/<slug>.vN.plan.json y assets/terminados/<slug>-vN.mp4).
// Solo lectura: el panel muestra planes y videos; editar y exportar lo hace el agente (/editar-video).
import fs from 'node:fs/promises';
import path from 'node:path';
import { AGENCIA_ROOT } from './data.js';

const PLAN_RE = /^([A-Za-z0-9][A-Za-z0-9_-]{0,80})\.v(\d{1,3})\.plan\.json$/;
const PREVIEW_RE = /^([A-Za-z0-9][A-Za-z0-9_-]{0,80})\.v(\d{1,3})\.preview\.mp4$/;
const MP4_RE = /^([A-Za-z0-9][A-Za-z0-9_-]{0,80})-v(\d{1,3})\.mp4$/;
const dirs = (slug) => ({
  edicion: path.join(AGENCIA_ROOT, 'clientes', slug, 'assets', 'edicion'),
  terminados: path.join(AGENCIA_ROOT, 'clientes', slug, 'assets', 'terminados'),
});
const ls = async (d) => { try { return await fs.readdir(d); } catch { return []; } };

export async function listarVideos(slug) {
  const { edicion, terminados } = dirs(slug);
  const porVideo = new Map();
  const nuevo = (id) => { if (!porVideo.has(id)) porVideo.set(id, { id, versiones: new Map() }); return porVideo.get(id); };

  for (const f of await ls(edicion)) {
    const m = PLAN_RE.exec(f);
    if (!m) continue;
    let plan;
    try { plan = JSON.parse(await fs.readFile(path.join(edicion, f), 'utf8')); } catch { continue; }
    const n = Number(m[2]);
    nuevo(m[1]).versiones.set(n, {
      n,
      tipo: plan.tipo === 'html' ? 'html' : 'bruto',
      formato: plan.formato || '',
      bruto: plan.bruto || '',
      brief: plan.brief || '',
      duracion: typeof plan.duracion === 'number' ? plan.duracion : null,
      aprobadoTotal: plan.aprobado_total === true,
      subtitulos: plan.subtitulos?.activo === true,
      escenas: (Array.isArray(plan.escenas) ? plan.escenas : []).map((e) => ({
        n: e.n, inicio: e.origen?.inicio, fin: e.origen?.fin, duracion: typeof e.duracion === 'number' ? e.duracion : null, titulo: e.titulo || '', descripcion: e.descripcion || '',
        sonido: e.sonido || '', estado: e.estado || 'pendiente', notas: e.notas || '',
      })),
      mp4: null,
      preview: null,
    });
  }
  // Vistas previas (borradores de baja calidad) que deja el agente en assets/edicion/<video>.vN.preview.mp4.
  for (const f of await ls(edicion)) {
    const m = PREVIEW_RE.exec(f);
    const ver = m && porVideo.get(m[1])?.versiones.get(Number(m[2]));
    if (ver) ver.preview = f;
  }
  for (const f of await ls(terminados)) {
    const m = MP4_RE.exec(f);
    if (!m) continue;
    const v = nuevo(m[1]);
    const n = Number(m[2]);
    const ver = v.versiones.get(n) || { n, tipo: 'bruto', formato: '', bruto: '', brief: '', duracion: null, aprobadoTotal: true, subtitulos: false, escenas: [], mp4: null, preview: null };
    ver.mp4 = f;
    v.versiones.set(n, ver);
  }
  return [...porVideo.values()]
    .map((v) => ({ id: v.id, versiones: [...v.versiones.values()].sort((a, b) => a.n - b.n) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Ruta del mp4 terminado (<video>-vN.mp4) o de la vista previa (<video>.vN.preview.mp4); null si el nombre no coincide exacto.
export function archivoDeVideo(slug, archivo) {
  if (typeof archivo !== 'string') return null;
  if (PREVIEW_RE.test(archivo)) return path.join(dirs(slug).edicion, archivo);
  if (!MP4_RE.test(archivo)) return null;
  return path.join(dirs(slug).terminados, archivo);
}

// Imágenes reales del cliente que se pueden usar en un video creado desde cero (assets/fotos y assets/identidad).
// Devuelve rutas relativas a assets/ (ej. "fotos/trabajos/obra-1.jpg"). Solo lista nombres: no sirve los archivos.
const IMG_RE = /\.(jpe?g|png|webp)$/i;
export async function listarImagenes(slug) {
  const base = path.join(AGENCIA_ROOT, 'clientes', slug, 'assets');
  const out = [];
  const recorrer = async (rel, nivel) => {
    let items;
    try { items = await fs.readdir(path.join(base, rel), { withFileTypes: true }); } catch { return; }
    for (const e of items) {
      if (out.length >= 200) return;
      const r = rel + '/' + e.name;
      if (e.isDirectory() && nivel < 3) await recorrer(r, nivel + 1);
      else if (e.isFile() && IMG_RE.test(e.name)) out.push(r);
    }
  };
  for (const d of ['fotos', 'identidad']) await recorrer(d, 1);
  return out.sort();
}
