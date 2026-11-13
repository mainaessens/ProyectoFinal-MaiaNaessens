// Última sesión del agente por cliente, para poder retomarla tras recargar la página.
// Solo se guarda el id (no el historial). Todo acceso a localStorage va en try/catch: puede no estar disponible.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENTE_RE = /^[a-z0-9][a-z0-9-]*$/;
const ULTIMO = 'faro.ultimoCliente'; // fuera del prefijo faro.sesion.* para no chocar con un cliente llamado «ultimo»

const clave = (cliente) => {
  if (cliente && !CLIENTE_RE.test(cliente)) return null;
  return `faro.sesion.${cliente || '_global'}`;
};

/** Devuelve { id, skill, fecha } o null. Un valor alterado o inválido se ignora. */
export function leerSesion(cliente) {
  const k = clave(cliente);
  if (!k) return null;
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    if (!v || typeof v.id !== 'string' || !UUID_RE.test(v.id)) return null;
    return { id: v.id, skill: typeof v.skill === 'string' ? v.skill.slice(0, 60) : '', fecha: Number(v.fecha) || 0 };
  } catch { return null; }
}

export function guardarSesion(cliente, { id, skill }) {
  const k = clave(cliente);
  if (!k || !UUID_RE.test(id || '')) return;
  try {
    localStorage.setItem(k, JSON.stringify({ id, skill: skill || '', fecha: Date.now() }));
    localStorage.setItem(ULTIMO, cliente || '');
  } catch { /* sin almacenamiento */ }
}

/** Cliente de la última sesión guardada (para preseleccionarlo al recargar). Vacío si no hay o es inválido. */
export function ultimoCliente() {
  try {
    const c = localStorage.getItem(ULTIMO) || '';
    return CLIENTE_RE.test(c) ? c : '';
  } catch { return ''; }
}

export function borrarSesion(cliente) {
  const k = clave(cliente);
  if (!k) return;
  try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ }
}
