#!/usr/bin/env node
// Moviola — editor de video de la agencia. Sin dependencias de npm; usa FFmpeg y faster-whisper locales.
// Todo corre en este ordenador. Salida siempre en JSON (la lee el agente). Uso: node moviola.mjs <comando> ...
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseSilencios, segmentosConservados, duracionTotal } from "./lib/edl.mjs";
import { MoviolaError, checkSlug, resolverEnAssets, validarPlan, puedeExportar, nombreSalida } from "./lib/plan.mjs";
import { generarAss, palabrasEnSalida } from "./lib/subtitulos.mjs";
import { argsRender, argsSilencios, argsSondeo, argsFotograma } from "./lib/ffmpeg.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.AGENCIA_ROOT || path.resolve(aqui, "..", "..");
const exe = process.platform === "win32" ? ".exe" : "";

function ejecutar(cmd, args, { cwd, entrada } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => resolve({ code: -1, stdout: out, stderr: String(e.message) }));
    p.on("close", (code) => resolve({ code, stdout: out, stderr: err }));
    if (entrada) p.stdin.end(entrada);
  });
}

// winget a veces no crea el acceso directo en Links: busca el .exe dentro de Packages (profundidad limitada).
function enCarpeta(dir, archivo, prof) {
  if (prof < 0 || !fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase() === archivo.toLowerCase()) out.push(p);
    else if (e.isDirectory()) out.push(...enCarpeta(p, archivo, prof - 1));
  }
  return out;
}

// Busca un ejecutable: variable de entorno, PATH y las carpetas donde winget deja los accesos.
function candidatos(nombre) {
  const env = process.env[`MOVIOLA_${nombre.toUpperCase().replace(/-/g, "_")}`];
  const extra = [];
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const wg = path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet");
    extra.push(path.join(wg, "Links", `${nombre}${exe}`), ...enCarpeta(path.join(wg, "Packages"), `${nombre}${exe}`, 4));
  }
  return [env, `${nombre}${exe}`, ...extra].filter(Boolean);
}
async function buscar(nombre, probar = ["-version"]) {
  for (const c of candidatos(nombre)) {
    const r = await ejecutar(c, probar);
    if (r.code === 0) return c;
  }
  return null;
}
async function buscarPython() {
  const lista = [process.env.MOVIOLA_PYTHON, "python", "python3"].filter(Boolean);
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const base = path.join(process.env.LOCALAPPDATA, "Programs", "Python");
    if (fs.existsSync(base)) for (const d of fs.readdirSync(base).sort().reverse()) lista.push(path.join(base, d, "python.exe"));
  }
  for (const c of lista) {
    const r = await ejecutar(c, ["-c", "import sys;print(sys.version.split()[0])"]);
    if (r.code === 0 && /^\d+\.\d+/.test(r.stdout.trim())) return { cmd: c, version: r.stdout.trim() };
  }
  return null;
}

const leerJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const carpeta = (cliente, ...p) => path.join(ROOT, "clientes", checkSlug(cliente, "cliente"), ...p);
const slugDe = (archivo) => path.basename(archivo, path.extname(archivo)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "video";
const log = (cliente, msg) => fs.appendFileSync(carpeta(cliente, "registro-actividad.log"), `[${new Date().toISOString().slice(0, 10)}] moviola: ${msg}\n`);

async function sondear(ffprobe, abs) {
  const r = await ejecutar(ffprobe, argsSondeo(abs));
  if (r.code !== 0) throw new MoviolaError(`ffprobe no pudo leer el archivo: ${r.stderr.slice(0, 200)}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === "video"), a = j.streams.find((s) => s.codec_type === "audio");
  return { duracion: Math.round(parseFloat(j.format.duration) * 100) / 100, ancho: v?.width ?? null, alto: v?.height ?? null, tiene_audio: !!a, fps: v?.r_frame_rate ?? null };
}

const comandos = {
  async doctor() {
    const ffmpeg = await buscar("ffmpeg"), ffprobe = await buscar("ffprobe"), ytdlp = await buscar("yt-dlp", ["--version"]);
    const py = await buscarPython();
    let whisper = false;
    if (py) whisper = (await ejecutar(py.cmd, ["-c", "import faster_whisper"])).code === 0;
    const nodeOk = Number(process.versions.node.split(".")[0]) >= 20;
    const faltan = [!ffmpeg && "ffmpeg", !ffprobe && "ffprobe", !py && "python", py && !whisper && "faster-whisper", !nodeOk && "node>=20"].filter(Boolean);
    return {
      listo_para_editar: faltan.length === 0, faltan,
      herramientas: { node: process.versions.node, ffmpeg, ffprobe, python: py, faster_whisper: whisper, yt_dlp: ytdlp, so: `${os.platform()} ${os.arch()}` },
      opcionales: { yt_dlp: ytdlp ? "ok" : "falta (solo para bajar videos de referencia)", hyperframes: "no verificado (opcional: motion graphics avanzados)" },
    };
  },

  async preparar([cliente]) {
    const dirs = ["videos", "referencias", "edicion", "terminados"].map((d) => carpeta(cliente, "assets", d));
    for (const d of dirs) fs.mkdirSync(d, { recursive: true });
    const marca = carpeta(cliente, "hoja-de-marca.json");
    const creada = !fs.existsSync(marca);
    if (creada) {
      fs.writeFileSync(marca, JSON.stringify({
        estado: "borrador — completar con el perfil y los reels de referencia",
        colores: { texto: "#FFFFFF", resalta: "#F2B134", contorno: "#000000" },
        fuentes: { titulos: "Arial", subtitulos: "Arial" },
        subtitulos: { tamano: 84, palabras_por_linea: 3 },
        titulos: { tamano: 150 },
        nunca: [], notas: [],
      }, null, 2) + "\n");
    }
    return { carpetas: dirs.map((d) => path.relative(ROOT, d)), hoja_de_marca: path.relative(ROOT, marca), hoja_creada: creada };
  },

  async sondear([cliente, rel]) {
    const ffprobe = await buscar("ffprobe");
    if (!ffprobe) throw new MoviolaError("falta ffprobe (FFmpeg). Ejecutá: node moviola.mjs doctor");
    return sondear(ffprobe, resolverEnAssets(ROOT, cliente, rel));
  },

  async transcribir([cliente, rel, ...o]) {
    const opt = Object.fromEntries(o.reduce((a, x, i, arr) => (x.startsWith("--") ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
    const modelo = opt.modelo || "small", idioma = opt.idioma || "es";
    if (!/^[a-z0-9.-]+$/i.test(modelo) || !/^[a-z]{2,3}$/.test(idioma)) throw new MoviolaError("modelo o idioma inválido.");
    const py = await buscarPython();
    if (!py) throw new MoviolaError("falta Python. Ejecutá: node moviola.mjs doctor");
    const entrada = resolverEnAssets(ROOT, cliente, rel);
    const salida = carpeta(cliente, "assets", "edicion", `${slugDe(rel)}.transcripcion.json`);
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    const r = await ejecutar(py.cmd, [path.join(aqui, "whisper_words.py"), entrada, salida, modelo, idioma]);
    if (r.code !== 0) throw new MoviolaError(`Whisper falló: ${r.stderr.slice(-300)}`);
    const t = leerJson(salida);
    return { transcripcion: path.relative(path.join(ROOT, "clientes", cliente), salida).replace(/\\/g, "/"), palabras: t.palabras.length, duracion: t.duracion, texto: t.palabras.map((p) => p.palabra).join(" ") };
  },

  async silencios([cliente, rel, ...o]) {
    const opt = Object.fromEntries(o.reduce((a, x, i, arr) => (x.startsWith("--") ? [...a, [x.slice(2), parseFloat(arr[i + 1])]] : a), []));
    const ffmpeg = await buscar("ffmpeg"), ffprobe = await buscar("ffprobe");
    if (!ffmpeg || !ffprobe) throw new MoviolaError("falta FFmpeg. Ejecutá: node moviola.mjs doctor");
    const entrada = resolverEnAssets(ROOT, cliente, rel);
    const info = await sondear(ffprobe, entrada);
    const r = await ejecutar(ffmpeg, argsSilencios(entrada, { umbralDb: opt.umbral ?? -35, minimo: opt.minimo ?? 0.45 }));
    const silencios = parseSilencios(r.stderr, info.duracion);
    const conservar = segmentosConservados(info.duracion, silencios, { minSilencio: opt.minimo ?? 0.45 });
    return { duracion_original: info.duracion, silencios: silencios.length, duracion_sin_silencios: duracionTotal(conservar), conservar };
  },

  async validar([cliente, rel]) {
    const plan = leerJson(resolverEnAssets(ROOT, cliente, rel));
    const problemas = validarPlan(plan);
    return { valido: problemas.length === 0, problemas, exportable: puedeExportar(plan) };
  },

  async fotograma([cliente, rel, segundo]) {
    const ffmpeg = await buscar("ffmpeg");
    if (!ffmpeg) throw new MoviolaError("falta FFmpeg.");
    const s = Number(segundo);
    if (!(s >= 0)) throw new MoviolaError("segundo inválido.");
    const salida = carpeta(cliente, "assets", "edicion", `${slugDe(rel)}-${Math.round(s * 10)}.jpg`);
    const r = await ejecutar(ffmpeg, argsFotograma(resolverEnAssets(ROOT, cliente, rel), s, salida));
    if (r.code !== 0) throw new MoviolaError(`no se pudo extraer el fotograma: ${r.stderr.slice(0, 200)}`);
    return { fotograma: path.relative(ROOT, salida).replace(/\\/g, "/") };
  },

  // --preview: baja resolución para revisar (no exige aprobación). Sin --preview: exporta el final,
  // y SOLO si el plan tiene aprobado_total:true y todas las escenas aprobadas.
  async renderizar([cliente, rel, ...o]) {
    const preview = o.includes("--preview");
    const planAbs = resolverEnAssets(ROOT, cliente, rel);
    const plan = leerJson(planAbs);
    const problemas = validarPlan(plan);
    if (problemas.length) throw new MoviolaError(`plan inválido: ${problemas.join(" | ")}`);
    if (plan.cliente !== cliente) throw new MoviolaError("el plan pertenece a otro cliente.");
    if (!preview) {
      const gate = puedeExportar(plan);
      if (!gate.ok) throw new MoviolaError(`BLOQUEADO: no se exporta el video final — ${gate.motivo} Usá --preview para revisar.`);
    }
    const ffmpeg = await buscar("ffmpeg"), ffprobe = await buscar("ffprobe");
    if (!ffmpeg || !ffprobe) throw new MoviolaError("falta FFmpeg. Ejecutá: node moviola.mjs doctor");
    const bruto = resolverEnAssets(ROOT, cliente, plan.bruto);
    const info = await sondear(ffprobe, bruto);
    for (const s of plan.escenas) if (s.origen.fin > info.duracion + 0.1) throw new MoviolaError(`escena ${s.n}: termina en ${s.origen.fin}s pero el bruto dura ${info.duracion}s.`);

    const trabajo = carpeta(cliente, "assets", "edicion");
    fs.mkdirSync(trabajo, { recursive: true });
    fs.mkdirSync(carpeta(cliente, "assets", "terminados"), { recursive: true });

    const marcaPath = carpeta(cliente, "hoja-de-marca.json");
    if (!fs.existsSync(marcaPath) && !preview) throw new MoviolaError("falta hoja-de-marca.json: ejecutá 'preparar' y completala antes de exportar.");
    const marca = fs.existsSync(marcaPath) ? leerJson(marcaPath) : {};

    let assNombre = null;
    const conSubs = plan.subtitulos?.activo !== false;
    const hayTitulos = plan.escenas.some((s) => s.titulo);
    if (conSubs || hayTitulos) {
      let palabras = [];
      if (conSubs) {
        const tr = path.join(ROOT, "clientes", cliente, plan.transcripcion || `assets/edicion/${slugDe(plan.bruto)}.transcripcion.json`);
        if (!fs.existsSync(tr)) throw new MoviolaError("faltan los subtítulos: ejecutá 'transcribir' o poné subtitulos.activo:false en el plan.");
        palabras = palabrasEnSalida(leerJson(tr).palabras, plan);
      }
      const dims = preview ? { ancho: 540, alto: 960 } : { ancho: 1080, alto: 1920 };
      assNombre = `${plan.slug}-v${plan.version}.ass`;
      fs.writeFileSync(path.join(trabajo, assNombre), generarAss({ plan, palabras, marca, ...(preview ? {} : dims) }));
      if (preview) {
        // El .ass está escrito para 1080x1920; en preview se escala solo (PlayRes fijo), no hace falta otro archivo.
      }
    }

    const nombre = nombreSalida(plan, preview);
    const destino = carpeta(cliente, "assets", "terminados", nombre);
    const args = argsRender({ bruto, plan, ass: assNombre, salida: destino, preview, tieneAudio: info.tiene_audio });
    const r = await ejecutar(ffmpeg, args, { cwd: trabajo });
    if (r.code !== 0) throw new MoviolaError(`FFmpeg falló: ${r.stderr.slice(-400)}`);
    const out = await sondear(ffprobe, destino);
    const rel2 = `assets/terminados/${nombre}`;
    if (!preview) {
      fs.writeFileSync(`${destino}.render.json`, JSON.stringify({ plan: path.basename(planAbs), version: plan.version, exportado: new Date().toISOString(), ...out }, null, 2));
      log(cliente, `video ${nombre} exportado (${out.duracion}s, ${out.ancho}x${out.alto}) desde plan v${plan.version}`);
    }
    return { archivo: rel2, preview, ...out, advertencias: [
      out.duracion > 90 ? "dura más de 90 s: Instagram limita los reels." : null,
      !marca.fuentes ? "sin hoja de marca: se usaron fuentes y colores por defecto." : null,
    ].filter(Boolean) };
  },

  async "bajar-referencia"([cliente, url]) {
    let u;
    try { u = new URL(url); } catch { throw new MoviolaError("URL inválida."); }
    if (u.protocol !== "https:" || !/(^|\.)(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)$/.test(u.hostname)) throw new MoviolaError("solo https de instagram, tiktok o youtube.");
    const ytdlp = await buscar("yt-dlp", ["--version"]);
    if (!ytdlp) throw new MoviolaError("falta yt-dlp.");
    const dir = carpeta(cliente, "assets", "referencias");
    fs.mkdirSync(dir, { recursive: true });
    const r = await ejecutar(ytdlp, ["--no-playlist", "-o", path.join(dir, "%(id)s.%(ext)s"), "--print", "after_move:filepath", url]);
    if (r.code !== 0) throw new MoviolaError(`yt-dlp falló: ${r.stderr.slice(-300)}`);
    return { archivo: path.relative(path.join(ROOT, "clientes", cliente), r.stdout.trim().split(/\r?\n/).pop()).replace(/\\/g, "/"), aviso: "Solo para estudiar estilo y ritmo. No se republica ni se reutiliza el contenido ajeno." };
  },
};

export { comandos };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...resto] = process.argv.slice(2);
  try {
    if (!comandos[cmd]) throw new MoviolaError(`comando desconocido. Disponibles: ${Object.keys(comandos).join(", ")}`);
    console.log(JSON.stringify(await comandos[cmd](resto), null, 2));
  } catch (e) {
    console.log(JSON.stringify({ error: e.message }, null, 2));
    process.exitCode = e instanceof MoviolaError ? 2 : 1;
  }
}
