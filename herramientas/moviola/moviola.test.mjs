import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseSilencios, segmentosConservados, duracionTotal } from "./lib/edl.mjs";
import { validarPlan, puedeExportar, lineaDeTiempo, resolverEnAssets, nombreSalida } from "./lib/plan.mjs";
import { generarAss, palabrasEnSalida, colorAss, colorTag, tiempoAss } from "./lib/subtitulos.mjs";
import { argsRender, argsSilencios } from "./lib/ffmpeg.mjs";

const planBase = (extra = {}) => ({
  cliente: "demo", slug: "reel-uno", version: 1, bruto: "assets/videos/bruto.mp4", formato: "reel", aprobado_total: false,
  escenas: [
    { n: 1, origen: { inicio: 0, fin: 4 }, titulo: "TODO ESTO LO EDITÓ CLAUDE", estado: "pendiente" },
    { n: 2, origen: { inicio: 10, fin: 14 }, estado: "pendiente" },
  ],
  ...extra,
});

test("parseSilencios lee silencedetect y cierra un silencio final con la duración", () => {
  const txt = "[silencedetect @ 0x1] silence_start: 1.5\n[silencedetect @ 0x1] silence_end: 2.7 | silence_duration: 1.2\n[silencedetect @ 0x1] silence_start: 9.1";
  assert.deepEqual(parseSilencios(txt, 10), [{ inicio: 1.5, fin: 2.7 }, { inicio: 9.1, fin: 10 }]);
});

test("segmentosConservados corta silencios largos con margen y descarta tramos mínimos", () => {
  const seg = segmentosConservados(10, [{ inicio: 2, fin: 3 }, { inicio: 5, fin: 5.2 }, { inicio: 9, fin: 10 }]);
  assert.deepEqual(seg, [{ inicio: 0, fin: 2.12 }, { inicio: 2.88, fin: 9.12 }]);
  assert.equal(duracionTotal(seg), 8.36);
});

test("validarPlan acepta un plan válido y reporta cada problema", () => {
  assert.deepEqual(validarPlan(planBase()), []);
  const mal = validarPlan(planBase({ cliente: "../x", formato: "tv", escenas: [{ n: 1, origen: { inicio: 5, fin: 5.1 }, estado: "ok" }] }));
  assert.ok(mal.length >= 4);
  assert.ok(validarPlan(planBase({ escenas: [] })).some((e) => /al menos una escena/.test(e)));
  assert.ok(validarPlan(planBase({ escenas: [{ n: 1, origen: { inicio: 0, fin: 3 }, estado: "pendiente" }, { n: 1, origen: { inicio: 3, fin: 6 }, estado: "pendiente" }] })).some((e) => /único/.test(e)));
});

test("barrera: no se exporta sin aprobado_total y TODAS las escenas aprobadas", () => {
  assert.equal(puedeExportar(planBase()).ok, false);
  const aprobadoSoloTotal = planBase({ aprobado_total: true });
  assert.match(puedeExportar(aprobadoSoloTotal).motivo, /escenas sin aprobar: 1, 2/);
  const casi = planBase({ aprobado_total: false });
  casi.escenas.forEach((s) => (s.estado = "aprobada"));
  assert.equal(puedeExportar(casi).ok, false);
  const ok = planBase({ aprobado_total: true });
  ok.escenas.forEach((s) => (s.estado = "aprobada"));
  assert.equal(puedeExportar(ok).ok, true);
});

test("resolverEnAssets no deja salir de clientes/<cliente>/assets", () => {
  const root = "/agencia";
  assert.ok(resolverEnAssets(root, "demo", "assets/videos/a.mp4").endsWith(path.join("demo", "assets", "videos", "a.mp4")));
  for (const mal of ["../otro/assets/a.mp4", "assets/../../x.mp4", "perfil.md", "/etc/passwd", "C:\\x.mp4"]) {
    assert.throws(() => resolverEnAssets(root, "demo", mal), /assets|relativa/, mal);
  }
  assert.throws(() => resolverEnAssets(root, "../demo", "assets/a.mp4"), /cliente/);
});

test("lineaDeTiempo ubica las escenas en el video ya cortado", () => {
  const t = lineaDeTiempo(planBase());
  assert.deepEqual(t.map((s) => s.salida), [{ inicio: 0, fin: 4 }, { inicio: 4, fin: 8 }]);
  assert.equal(nombreSalida(planBase(), true), "reel-uno-v1-preview.mp4");
});

test("palabrasEnSalida reubica las palabras de cada escena y descarta las cortadas", () => {
  const palabras = [
    { palabra: "hola", inicio: 0.5, fin: 0.9 },
    { palabra: "eeeh", inicio: 5, fin: 5.5 }, // cae en el tramo cortado (4–10)
    { palabra: "mundo", inicio: 10.5, fin: 11 },
  ];
  const out = palabrasEnSalida(palabras, planBase());
  assert.deepEqual(out.map((p) => [p.palabra, p.inicio, p.fin]), [["hola", 0.5, 0.9], ["mundo", 4.5, 5]]);
});

test("colores y tiempos de ASS", () => {
  assert.equal(colorAss("#47220F"), "&H000F2247");
  assert.equal(colorTag("#47220F"), "&H0F2247&");
  assert.throws(() => colorAss("rojo"), /inválido/);
  assert.equal(tiempoAss(3725.5), "1:02:05.50");
});

test("generarAss: título, palabra activa resaltada, palabra clave siempre y texto neutralizado", () => {
  const plan = planBase({ subtitulos: { activo: true, palabras_clave: ["Claude"] } });
  const palabras = [{ palabra: "hola", inicio: 0, fin: 0.5 }, { palabra: "Claude,", inicio: 0.5, fin: 1 }, { palabra: "{\\fs999}x", inicio: 1, fin: 1.5 }];
  const ass = generarAss({ plan, palabras, marca: { colores: { texto: "#FFFFFF", resalta: "#F2B134" }, fuentes: { titulos: "Cormorant Garamond", subtitulos: "Montserrat" } } });
  assert.match(ass, /PlayResX: 1080/);
  assert.match(ass, /Style: Sub,Montserrat/);
  assert.match(ass, /Style: Titulo,Cormorant Garamond/);
  assert.match(ass, /Dialogue: 1,0:00:00.00,0:00:04.00,Titulo,.*TODO ESTO LO EDITÓ CLAUDE/);
  const subs = ass.split("\n").filter((l) => l.startsWith("Dialogue: 0,"));
  assert.match(subs[0], /\{\\c&H34B1F2&\}hola\{\\c&HFFFFFF&\}/); // la palabra que se dice va resaltada
  assert.ok(!/\{\\c&H34B1F2&\}hola/.test(subs[1]), "hola solo se resalta cuando se dice");
  assert.ok(subs.every((l) => /\{\\c&H34B1F2&\}Claude,/.test(l)), "la palabra clave va siempre resaltada");
  assert.ok(!ass.includes("\\fs999"), "el texto de la transcripción no puede inyectar overrides");
});

test("generarAss respeta subtitulos.activo:false (solo títulos)", () => {
  const ass = generarAss({ plan: planBase({ subtitulos: { activo: false } }), palabras: [{ palabra: "x", inicio: 0, fin: 1 }], marca: {} });
  assert.ok(!/Style: Sub,.*\nDialogue: 0/.test(ass) && !ass.includes("Dialogue: 0,"));
});

test("argsRender: recorta, encuadra a 9:16, une, quema subtítulos y normaliza el audio", () => {
  const a = argsRender({ bruto: "in.mp4", plan: planBase(), ass: "sub.ass", salida: "out.mp4" });
  const fc = a[a.indexOf("-filter_complex") + 1];
  assert.match(fc, /trim=start=0:end=4/);
  assert.match(fc, /trim=start=10:end=14/);
  assert.match(fc, /scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920/);
  assert.match(fc, /concat=n=2:v=1:a=1\[vc\]\[ac\]/);
  assert.match(fc, /ass=sub.ass/);
  assert.match(fc, /loudnorm=I=-14/);
  assert.ok(a.includes("+faststart") && a.includes("yuv420p") && a.at(-1) === "out.mp4");
});

test("argsRender: preview baja resolución y sin audio no mapea audio", () => {
  const p = argsRender({ bruto: "in.mp4", plan: planBase(), salida: "o.mp4", preview: true, tieneAudio: false });
  const fc = p[p.indexOf("-filter_complex") + 1];
  assert.match(fc, /scale=540:960/);
  assert.ok(!fc.includes("atrim") && p.includes("-an") && !p.includes("[aout]"));
  assert.match(fc, /\[vc\]null\[vout\]/);
});

test("argsSilencios usa silencedetect con umbral y duración mínima", () => {
  assert.ok(argsSilencios("a.mp4", { umbralDb: -30, minimo: 0.6 }).includes("silencedetect=noise=-30dB:d=0.6"));
});

test("CLI: renderizar final se BLOQUEA sin aprobación (no necesita FFmpeg para bloquear)", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moviola-"));
  process.env.AGENCIA_ROOT = root;
  fs.mkdirSync(path.join(root, "clientes", "demo", "assets", "edicion"), { recursive: true });
  fs.writeFileSync(path.join(root, "clientes", "demo", "assets", "edicion", "p.plan.json"), JSON.stringify(planBase()));
  const { comandos } = await import("./moviola.mjs?gate");
  await assert.rejects(comandos.renderizar(["demo", "assets/edicion/p.plan.json"]), /BLOQUEADO.*no está aprobado/);
  const v = await comandos.validar(["demo", "assets/edicion/p.plan.json"]);
  assert.equal(v.valido, true);
  assert.equal(v.exportable.ok, false);
});
