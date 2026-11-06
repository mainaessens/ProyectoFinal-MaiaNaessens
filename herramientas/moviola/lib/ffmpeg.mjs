// Construcción de los argumentos de FFmpeg (sin shell: siempre una lista de argumentos).
import { lineaDeTiempo } from "./plan.mjs";

const PERFILES = {
  final: { ancho: 1080, alto: 1920, crf: "18", preset: "medium" },
  preview: { ancho: 540, alto: 960, crf: "28", preset: "veryfast" },
};
const f = (n) => String(Math.round(n * 1000) / 1000);

/**
 * Un solo paso: recorta cada escena, la encuadra a vertical, las une, quema el .ass y normaliza el audio.
 * `ass` es un nombre de archivo RELATIVO a `cwd` (evita escapar rutas con ":" en Windows).
 */
export function argsRender({ bruto, plan, ass, salida, preview = false, tieneAudio = true }) {
  const p = PERFILES[preview ? "preview" : "final"];
  const esc = lineaDeTiempo(plan);
  const partes = [];
  const concatIn = [];
  esc.forEach((s, i) => {
    const { inicio, fin } = s.origen;
    partes.push(`[0:v]trim=start=${f(inicio)}:end=${f(fin)},setpts=PTS-STARTPTS,scale=${p.ancho}:${p.alto}:force_original_aspect_ratio=increase,crop=${p.ancho}:${p.alto},setsar=1,fps=30[v${i}]`);
    concatIn.push(`[v${i}]`);
    if (tieneAudio) {
      partes.push(`[0:a]atrim=start=${f(inicio)}:end=${f(fin)},asetpts=PTS-STARTPTS[a${i}]`);
      concatIn.push(`[a${i}]`);
    }
  });
  partes.push(`${concatIn.join("")}concat=n=${esc.length}:v=1:a=${tieneAudio ? 1 : 0}[vc]${tieneAudio ? "[ac]" : ""}`);
  partes.push(`[vc]${ass ? `ass=${ass}` : "null"}[vout]`);
  if (tieneAudio) partes.push("[ac]loudnorm=I=-14:TP=-1.5:LRA=11[aout]");

  return [
    "-y", "-hide_banner", "-loglevel", "error", "-i", bruto,
    "-filter_complex", partes.join(";"),
    "-map", "[vout]", ...(tieneAudio ? ["-map", "[aout]"] : []),
    "-c:v", "libx264", "-preset", p.preset, "-crf", p.crf, "-pix_fmt", "yuv420p", "-r", "30",
    ...(tieneAudio ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : ["-an"]),
    "-movflags", "+faststart", salida,
  ];
}

export const argsSilencios = (entrada, { umbralDb = -35, minimo = 0.45 } = {}) =>
  ["-hide_banner", "-nostats", "-i", entrada, "-vn", "-af", `silencedetect=noise=${umbralDb}dB:d=${minimo}`, "-f", "null", "-"];

export const argsSondeo = (entrada) =>
  ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", entrada];

export const argsFotograma = (entrada, segundo, salida) =>
  ["-y", "-hide_banner", "-loglevel", "error", "-ss", f(segundo), "-i", entrada, "-frames:v", "1", "-q:v", "3", salida];
