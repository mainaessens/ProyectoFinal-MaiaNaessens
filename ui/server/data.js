// Acceso a los datos de la agencia (carpeta clientes/ y .claude/skills/).
// Toda ruta que depende de input del usuario pasa por `safeSlug`/`safeFile`.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const AGENCIA_ROOT = process.env.AGENCIA_ROOT || path.resolve(here, '..', '..');
export const CLIENTES_DIR = path.join(AGENCIA_ROOT, 'clientes');
export const SKILLS_DIR = path.join(AGENCIA_ROOT, '.claude', 'skills');

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const PLAN_RE = /^[A-Za-z0-9._-]+\.plan\.json$/;

export const safeSlug = (s) => (typeof s === 'string' && SLUG_RE.test(s) ? s : null);
export const safePlanFile = (f) => (typeof f === 'string' && PLAN_RE.test(f) ? f : null);

const readText = async (p) => {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
};

export async function listClientes() {
  const entries = await fs.readdir(CLIENTES_DIR, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name === 'plantilla' || !safeSlug(e.name)) continue;
    const planes = await listPlanes(e.name);
    const perfil = (await readText(path.join(CLIENTES_DIR, e.name, 'perfil.md'))) || '';
    const nombre = /\*\*Nombre del cliente:\*\*\s*(.+)/.exec(perfil)?.[1]?.replace(/\*|—.*$/g, '').trim() || e.name;
    const log = await readLog(e.name, 1);
    out.push({
      slug: e.name,
      nombre,
      planes: {
        total: planes.length,
        pendientes: planes.filter((p) => p.aprobado !== true && p.estado !== 'rechazado').length,
        aprobados: planes.filter((p) => p.aprobado === true).length,
      },
      ultimaActividad: log[0] || null,
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function listPlanes(slug) {
  const dir = path.join(CLIENTES_DIR, slug, 'historial');
  let files = [];
  try { files = (await fs.readdir(dir)).filter((f) => PLAN_RE.test(f)); } catch { return []; }
  const planes = [];
  for (const f of files) {
    try {
      const plan = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      planes.push({ archivo: f, ...plan });
    } catch {
      planes.push({ archivo: f, error: 'JSON inválido' });
    }
  }
  return planes.sort((a, b) => b.archivo.localeCompare(a.archivo));
}

export async function readLog(slug, limit = 200) {
  const txt = (await readText(path.join(CLIENTES_DIR, slug, 'registro-actividad.log'))) || '';
  return txt.split(/\r?\n/).filter(Boolean).reverse().slice(0, limit);
}

export async function getCliente(slug) {
  const base = path.join(CLIENTES_DIR, slug);
  try { await fs.access(base); } catch { return null; }
  const extra = (await fs.readdir(base)).filter((f) => /^tendencias-.*\.md$/.test(f)).sort().reverse();
  return {
    slug,
    perfil: await readText(path.join(base, 'perfil.md')),
    calendario: await readText(path.join(base, 'calendario-editorial.md')),
    aprendizajes: await readText(path.join(base, 'aprendizajes.md')),
    tendencias: extra[0] ? await readText(path.join(base, extra[0])) : null,
    // Todos los informes de tendencias (tendencias-AAAA-MM.md), el más reciente primero.
    tendenciasLista: await Promise.all(extra.map(async (f) => ({ archivo: f, texto: (await readText(path.join(base, f))) || '' }))),
    planes: await listPlanes(slug),
    actividad: await readLog(slug),
    analisis: await listAnalisis(slug),
  };
}

// Análisis de Instagram del community-manager (clientes/<c>/analisis/*.md), el más nuevo primero.
export async function listAnalisis(slug) {
  const dir = path.join(CLIENTES_DIR, slug, 'analisis');
  let files = [];
  try { files = (await fs.readdir(dir)).filter((f) => /^[A-Za-z0-9._-]+\.md$/.test(f)); } catch { return []; }
  const out = [];
  for (const f of files) {
    const stat = await fs.stat(path.join(dir, f));
    out.push({ archivo: f, modificado: stat.mtimeMs, texto: await fs.readFile(path.join(dir, f), 'utf8') });
  }
  return out.sort((a, b) => b.modificado - a.modificado);
}

// Aprobar / rechazar un plan. Es la acción humana del ciclo proponer → revisar → ejecutar:
// el hook validar-publicacion.ps1 busca "aprobado": true en estos mismos archivos.
export async function decidirPlan(slug, archivo, aprobado) {
  const file = path.join(CLIENTES_DIR, slug, 'historial', archivo);
  const plan = JSON.parse(await fs.readFile(file, 'utf8'));
  plan.aprobado = aprobado === true;
  plan.estado = aprobado ? 'aprobado_desde_faro' : 'rechazado';
  plan.decision = { por: 'faro-ui', fecha: new Date().toISOString() };
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, file);
  const hoy = new Date().toISOString().slice(0, 10);
  const linea = `[${hoy}] Postagent UI: plan ${archivo} ${aprobado ? 'APROBADO' : 'RECHAZADO'} por el operador.\n`;
  await fs.appendFile(path.join(CLIENTES_DIR, slug, 'registro-actividad.log'), linea, 'utf8');
  return { archivo, ...plan };
}

export async function listSkills() {
  const out = [];
  for (const d of await fs.readdir(SKILLS_DIR, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const md = await readText(path.join(SKILLS_DIR, d.name, 'SKILL.md'));
    if (!md) continue;
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] || '';
    const get = (k) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm)?.[1]?.replace(/^["']|["']$/g, '').trim();
    out.push({
      name: get('name') || d.name,
      description: get('description') || '',
      argumentHint: get('argument-hint') || '',
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
