// Modelos que se pueden elegir desde el panel. Lista cerrada: el navegador solo manda un id y se valida contra ella
// (nunca se arma un argumento de línea de comandos con texto libre).
const BASE = [
  { id: 'opus', nombre: 'Opus · el más capaz y el más caro' },
  { id: 'sonnet', nombre: 'Sonnet · equilibrado' },
  { id: 'haiku', nombre: 'Haiku · rápido y barato' },
];
const ID_RE = /^[A-Za-z0-9._\[\]-]{1,60}$/;

/** Modelos permitidos: los alias base más los de FARO_MODELS (separados por coma, con formato estricto). */
export function listarModelos(env = process.env) {
  const extra = (env.FARO_MODELS || '').split(',').map((s) => s.trim())
    .filter((id) => ID_RE.test(id) && !BASE.some((b) => b.id === id))
    .map((id) => ({ id, nombre: id }));
  return [...BASE, ...extra];
}

/** Modelo con el que arranca Postagent si el operador no elige uno (FARO_MODEL); vacío = el de Claude Code. */
export function modeloPorDefecto(env = process.env) {
  const m = env.FARO_MODEL || '';
  return ID_RE.test(m) ? m : '';
}

/** Devuelve el id validado, o null si no se eligió ninguno (se usa el predeterminado). Lanza si no está permitido. */
export function validarModelo(id, env = process.env) {
  if (id === undefined || id === null || id === '') return null;
  if (typeof id !== 'string' || !listarModelos(env).some((m) => m.id === id)) throw new Error('Modelo no permitido.');
  return id;
}
