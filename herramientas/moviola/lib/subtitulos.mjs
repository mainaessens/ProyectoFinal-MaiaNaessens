// Subtítulos palabra a palabra y títulos animados, como archivo ASS (se queman con FFmpeg).
// Las palabras vienen de la transcripción y se reubican en el tiempo del video YA cortado.
import { lineaDeTiempo } from "./plan.mjs";

const cs = (s) => Math.max(0, Math.round(s * 100));
export function tiempoAss(s) {
  const c = cs(s), h = Math.floor(c / 360000), m = Math.floor((c % 360000) / 6000), seg = Math.floor((c % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}.${String(c % 100).padStart(2, "0")}`;
}

/** "#RRGGBB" -> "&H00BBGGRR" (formato de color de ASS). */
export function colorAss(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) throw new Error(`color inválido: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => m[1].slice(i, i + 2));
  return `&H00${b}${g}${r}`.toUpperCase();
}

/** "#RRGGBB" -> "&HBBGGRR&" (forma para etiquetas \c dentro de una línea de diálogo). */
export const colorTag = (hex) => `${colorAss(hex).slice(0, 2)}${colorAss(hex).slice(4)}&`;

// El texto de la transcripción es dato no confiable: se neutraliza cualquier override de ASS.
export const limpiar = (t) => String(t).replace(/[{}\\]/g, "").replace(/\r?\n/g, " ").trim();

/** Palabras dentro de cada escena, reubicadas en la línea de tiempo de salida. */
export function palabrasEnSalida(palabras, plan) {
  const out = [];
  for (const esc of lineaDeTiempo(plan)) {
    const { inicio: a, fin: b } = esc.origen;
    for (const p of palabras) {
      if (p.inicio >= a - 0.05 && p.fin <= b + 0.05) {
        const ini = Math.max(esc.salida.inicio, p.inicio - a + esc.salida.inicio);
        const fin = Math.min(esc.salida.fin, p.fin - a + esc.salida.inicio);
        if (fin > ini) out.push({ palabra: limpiar(p.palabra), inicio: ini, fin });
      }
    }
  }
  return out.filter((p) => p.palabra);
}

const quitaPuntuacion = (p) => p.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Genera el .ass. `marca` = hoja de marca:
 * { colores:{texto,resalta,contorno}, fuentes:{titulos,subtitulos}, subtitulos:{tamano,margen_inferior,palabras_por_linea}, titulos:{tamano,margen_superior} }
 */
export function generarAss({ plan, palabras, marca, ancho = 1080, alto = 1920 }) {
  const c = marca.colores || {};
  const texto = colorAss(c.texto || "#FFFFFF"), resalta = colorAss(c.resalta || "#F2B134"), contorno = colorAss(c.contorno || "#000000");
  const tagTexto = colorTag(c.texto || "#FFFFFF"), tagResalta = colorTag(c.resalta || "#F2B134");
  const fSub = marca.fuentes?.subtitulos || "Arial", fTit = marca.fuentes?.titulos || fSub;
  const sub = marca.subtitulos || {}, tit = marca.titulos || {};
  // Zonas seguras de Instagram: la interfaz tapa ~12 % arriba y ~25 % abajo.
  const margenInf = sub.margen_inferior ?? Math.round(alto * 0.3), margenSup = tit.margen_superior ?? Math.round(alto * 0.14);
  const porLinea = Math.max(1, sub.palabras_por_linea ?? 3);
  const clave = new Set((plan.subtitulos?.palabras_clave || []).map(quitaPuntuacion));

  const lineas = [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${ancho}`, `PlayResY: ${alto}`, "WrapStyle: 0", "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    `Style: Sub,${fSub},${sub.tamano ?? 84},${texto},${texto},${contorno},&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,${margenInf},1`,
    `Style: Titulo,${fTit},${tit.tamano ?? 150},${texto},${texto},${contorno},&H80000000,-1,0,0,0,100,100,0,0,1,8,3,8,60,60,${margenSup},1`,
    "", "[Events]", "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
  ];

  // Títulos: aparecen con un pequeño "pop" y se desvanecen.
  for (const esc of lineaDeTiempo(plan)) {
    if (!esc.titulo) continue;
    const fin = Math.min(esc.salida.fin, esc.salida.inicio + (esc.titulo_duracion ?? esc.salida.fin - esc.salida.inicio));
    lineas.push(`Dialogue: 1,${tiempoAss(esc.salida.inicio)},${tiempoAss(fin)},Titulo,,0,0,0,,{\\fad(150,200)\\t(0,180,\\fscx112\\fscy112)\\t(180,320,\\fscx100\\fscy100)}${limpiar(esc.titulo)}`);
  }

  // Subtítulos: grupos de N palabras; la palabra que se dice va resaltada, y las palabras clave siempre.
  if (plan.subtitulos?.activo !== false) {
    for (let i = 0; i < palabras.length; i += porLinea) {
      const grupo = palabras.slice(i, i + porLinea).map((w) => ({ ...w, palabra: limpiar(w.palabra) })); // defensa en profundidad: el texto nunca inyecta overrides
      grupo.forEach((w, k) => {
        const finVis = k === grupo.length - 1 ? w.fin : Math.max(w.fin, grupo[k + 1].inicio);
        const txt = grupo.map((x, j) => {
          const activa = j === k, esClave = clave.has(quitaPuntuacion(x.palabra));
          return activa || esClave ? `{\\c${tagResalta}}${x.palabra}{\\c${tagTexto}}` : x.palabra;
        }).join(" ");
        lineas.push(`Dialogue: 0,${tiempoAss(w.inicio)},${tiempoAss(finVis)},Sub,,0,0,0,,${txt}`);
      });
    }
  }
  return lineas.join("\n") + "\n";
}
