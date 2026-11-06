// Lista de cortes: de la salida de `ffmpeg silencedetect` a los tramos que se conservan.
const r2 = (n) => Math.round(n * 100) / 100;

/** Parsea el stderr de `silencedetect`. `duracion` cierra un silencio que llega hasta el final. */
export function parseSilencios(texto, duracion = null) {
  const out = [];
  let ini = null;
  for (const linea of String(texto).split(/\r?\n/)) {
    let m;
    if ((m = linea.match(/silence_start:\s*(-?[\d.]+)/))) ini = Math.max(0, parseFloat(m[1]));
    else if ((m = linea.match(/silence_end:\s*([\d.]+)/)) && ini !== null) {
      out.push({ inicio: r2(ini), fin: r2(parseFloat(m[1])) });
      ini = null;
    }
  }
  if (ini !== null && duracion !== null && duracion > ini) out.push({ inicio: r2(ini), fin: r2(duracion) });
  return out;
}

/**
 * Tramos a conservar. Un silencio más largo que `minSilencio` se corta, dejando `margen`
 * a cada lado para que la voz no quede "mordida". Descarta tramos menores a `minSegmento`.
 */
export function segmentosConservados(duracion, silencios, { minSilencio = 0.45, margen = 0.12, minSegmento = 0.3 } = {}) {
  const cortes = silencios
    .filter((s) => s.fin - s.inicio >= minSilencio)
    .map((s) => ({ inicio: Math.min(duracion, s.inicio + margen), fin: Math.max(0, s.fin - margen) }))
    .filter((s) => s.fin > s.inicio)
    .sort((a, b) => a.inicio - b.inicio);
  const keep = [];
  let cur = 0;
  for (const c of cortes) {
    if (c.inicio > cur) keep.push({ inicio: cur, fin: c.inicio });
    cur = Math.max(cur, c.fin);
  }
  if (cur < duracion) keep.push({ inicio: cur, fin: duracion });
  return keep.filter((k) => k.fin - k.inicio >= minSegmento).map((k) => ({ inicio: r2(k.inicio), fin: r2(k.fin) }));
}

export const duracionTotal = (tramos) => r2(tramos.reduce((a, t) => a + (t.fin - t.inicio), 0));
