// Plan de edición: lo que el humano revisa y aprueba escena por escena ANTES de exportar.
import path from "node:path";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
export const ESTADOS = ["pendiente", "aprobada", "cambios"];
const FORMATOS = ["reel", "historia"];
export const MIN_ESCENA = 0.2; // segundos

export class MoviolaError extends Error {}

export function checkSlug(valor, nombre) {
  if (typeof valor !== "string" || !SLUG_RE.test(valor)) throw new MoviolaError(`${nombre} inválido (minúsculas, números y guiones).`);
  return valor;
}

/** Resuelve `rel` dentro de clientes/<cliente>/assets/. Nunca sale de esa carpeta. */
export function resolverEnAssets(agenciaRoot, cliente, rel) {
  checkSlug(cliente, "cliente");
  if (typeof rel !== "string" || !rel || path.isAbsolute(rel)) throw new MoviolaError("la ruta debe ser relativa a clientes/<cliente>/.");
  const base = path.resolve(agenciaRoot, "clientes", cliente);
  const assets = path.join(base, "assets");
  const abs = path.resolve(base, rel);
  if (abs !== assets && !abs.startsWith(assets + path.sep)) throw new MoviolaError("la ruta debe estar dentro de assets/.");
  return abs;
}

/** Devuelve la lista de problemas del plan (vacía = válido). */
export function validarPlan(plan) {
  const e = [];
  if (!plan || typeof plan !== "object") return ["el plan no es un objeto JSON."];
  if (!SLUG_RE.test(plan.cliente ?? "")) e.push("cliente inválido.");
  if (!SLUG_RE.test(plan.slug ?? "")) e.push("slug inválido.");
  if (!Number.isInteger(plan.version) || plan.version < 1) e.push("version debe ser un entero >= 1.");
  if (typeof plan.bruto !== "string" || !plan.bruto.startsWith("assets/")) e.push("bruto debe ser una ruta dentro de assets/.");
  if (!FORMATOS.includes(plan.formato)) e.push(`formato debe ser ${FORMATOS.join(" o ")}.`);
  if (typeof plan.aprobado_total !== "boolean") e.push("aprobado_total debe ser booleano.");
  if (!Array.isArray(plan.escenas) || plan.escenas.length === 0) { e.push("el plan necesita al menos una escena."); return e; }
  const ns = new Set();
  for (const [i, s] of plan.escenas.entries()) {
    const id = `escena ${s?.n ?? i + 1}`;
    if (!Number.isInteger(s?.n) || s.n < 1 || ns.has(s.n)) e.push(`${id}: 'n' debe ser un entero único >= 1.`);
    ns.add(s?.n);
    const o = s?.origen;
    if (!o || !(o.inicio >= 0) || !(o.fin > o.inicio) || o.fin - o.inicio < MIN_ESCENA) e.push(`${id}: origen {inicio, fin} inválido (mínimo ${MIN_ESCENA}s).`);
    if (!ESTADOS.includes(s?.estado)) e.push(`${id}: estado debe ser ${ESTADOS.join(", ")}.`);
    if (s?.titulo != null && (typeof s.titulo !== "string" || s.titulo.length > 80)) e.push(`${id}: titulo debe ser texto de hasta 80 caracteres.`);
  }
  return e;
}

/** Barrera técnica: no se exporta el video final sin aprobación de TODAS las escenas. */
export function puedeExportar(plan) {
  const problemas = validarPlan(plan);
  if (problemas.length) return { ok: false, motivo: `plan inválido: ${problemas[0]}` };
  if (plan.aprobado_total !== true) return { ok: false, motivo: "el plan no está aprobado (aprobado_total:false)." };
  const sin = plan.escenas.filter((s) => s.estado !== "aprobada").map((s) => s.n);
  if (sin.length) return { ok: false, motivo: `escenas sin aprobar: ${sin.join(", ")}.` };
  return { ok: true };
}

/** Escenas con su posición en el video de salida. */
export function lineaDeTiempo(plan) {
  let t = 0;
  return plan.escenas.map((s) => {
    const dur = s.origen.fin - s.origen.inicio;
    const out = { ...s, salida: { inicio: Math.round(t * 100) / 100, fin: Math.round((t + dur) * 100) / 100 } };
    t += dur;
    return out;
  });
}

export const nombreSalida = (plan, preview) => `${plan.slug}-v${plan.version}${preview ? "-preview" : ""}.mp4`;
