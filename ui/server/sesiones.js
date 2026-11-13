// Almacén de sesiones del agente: una por archivo JSON en ui/.faro-data/sesiones/<uuid>.json.
// Guarda el historial que muestra el panel, para poder abrir una sesión anterior y continuarla con --resume.
// Todo id se valida como UUID (nunca se arma una ruta con texto libre).
import fs from 'node:fs/promises';
import path from 'node:path';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ENTRADAS = 800;
const MAX_TEXTO = 20000;

export const esIdValido = (id) => typeof id === 'string' && UUID_RE.test(id);

const limpiar = (entradas) => entradas.slice(-MAX_ENTRADAS).map((e) => ({ k: String(e.k).slice(0, 10), text: String(e.text ?? '').slice(0, MAX_TEXTO) }));

export function crearAlmacen({ dir, max = 50 }) {
  const ruta = (id) => {
    if (!esIdValido(id)) throw new Error('id de sesión inválido');
    return path.join(dir, `${id}.json`);
  };

  async function leer(id) {
    try { return JSON.parse(await fs.readFile(ruta(id), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) return null; throw e; }
  }

  async function podar() {
    const todas = await listar();
    for (const s of todas.slice(max)) await fs.rm(ruta(s.id), { force: true });
  }

  async function listar({ cliente } = {}) {
    let files = [];
    try { files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json') && esIdValido(f.slice(0, -5))); } catch { return []; }
    const out = [];
    for (const f of files) {
      const r = await leer(f.slice(0, -5));
      if (!r || (cliente !== undefined && (r.cliente || '') !== cliente)) continue;
      out.push({ id: r.id, cliente: r.cliente || '', skill: r.skill || '', titulo: r.titulo || '', creada: r.creada || 0, actualizada: r.actualizada || 0, entradas: (r.entradas || []).length });
    }
    return out.sort((a, b) => b.actualizada - a.actualizada);
  }

  return {
    leer,
    listar,
    async existe(id) { return esIdValido(id) && (await leer(id)) !== null; },
    async guardar(reg) {
      const final = {
        id: reg.id, cliente: reg.cliente || '', skill: reg.skill || '', titulo: String(reg.titulo || '').slice(0, 120),
        creada: reg.creada || Date.now(), actualizada: Date.now(), entradas: limpiar(reg.entradas || []),
      };
      await fs.mkdir(dir, { recursive: true });
      const destino = ruta(final.id);
      const tmp = `${destino}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(final), 'utf8');
      await fs.rename(tmp, destino);
      await podar();
    },
    async borrar(id) { await fs.rm(ruta(id), { force: true }); },
  };
}
