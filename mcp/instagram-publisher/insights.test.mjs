import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPublisher } from "./publisher.mjs";
import { resumirPublicaciones, diaHora, tipoDe } from "./insights.mjs";

const TOKEN = "EAAB-token-secreto-de-prueba-123456";

const MEDIAS = [
  { id: "1", caption: "Hola #pilates #salud\nsegunda línea", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: "2026-10-05T22:30:00+0000", like_count: 10, comments_count: 2, permalink: "https://ig/1" },
  { id: "2", caption: "Reel #a", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-10-12T13:00:00+0000", like_count: 30, comments_count: 5, permalink: "https://ig/2" },
  { id: "3", caption: "Vieja", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-08-01T13:00:00+0000", like_count: 1, comments_count: 0, permalink: "https://ig/3" },
];
const INSIGHTS = { 1: { reach: 100, saved: 8, shares: 2, total_interactions: 20, views: 150 }, 2: { reach: 400, saved: 20, shares: 15, total_interactions: 80, views: 900, ig_reels_avg_watch_time: 4200 } };

function mundo({ rechazar = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ig-ins-"));
  fs.mkdirSync(path.join(root, "clientes", "demo"), { recursive: true });
  fs.mkdirSync(path.join(root, ".claude"));
  fs.writeFileSync(path.join(root, ".claude", "instagram-cuentas.json"), JSON.stringify({ clientes: { demo: { ig_user_id: "1789" } } }));
  const calls = [];
  const graph = (u) => {
    const p = u.pathname.replace("/v1", "");
    const metric = u.searchParams.get("metric");
    if (metric && rechazar.includes(metric.split(",").length === 1 ? metric : "__lista__")) return { error: { message: `metric ${metric} no soportada` } };
    if (p === "/1789") return { username: "demo.ig", followers_count: 500, follows_count: 10, media_count: 40 };
    if (p === "/1789/media") return { data: MEDIAS };
    const m = p.match(/^\/(\d+)\/insights$/);
    if (m && INSIGHTS[m[1]]) {
      const set = metric.split(",").filter((k) => k in INSIGHTS[m[1]]);
      return { data: set.map((k) => ({ name: k, values: [{ value: INSIGHTS[m[1]][k] }] })) };
    }
    if (p === "/1789/insights") {
      if (metric === "follower_count") {
        const since = Number(u.searchParams.get("since")), until = Number(u.searchParams.get("until"));
        const vals = [{ value: 3, end_time: "2026-10-02T07:00:00+0000" }, { value: 2, end_time: "2026-10-03T07:00:00+0000" }]
          .filter((v) => Date.parse(v.end_time) / 1000 >= since && Date.parse(v.end_time) / 1000 <= until);
        return { data: [{ name: "follower_count", values: vals }] };
      }
      if (metric === "online_followers") return { data: [{ values: [{ value: { 19: 100, 20: 200 } }, { value: { 19: 300, 20: 200 } }] }] };
      if (metric === "follower_demographics") return { data: [{ total_value: { breakdowns: [{ results: [{ dimension_values: ["25-34"], value: 60 }] }] } }] };
      return { data: metric.split(",").map((k) => ({ name: k, total_value: { value: 10 } })) };
    }
    return { error: { message: "no mock " + p } };
  };
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    calls.push({ method: opts.method, path: u.pathname });
    const out = graph(u);
    return { ok: !out.error, status: out.error ? 400 : 200, json: async () => out, text: async () => JSON.stringify(out) };
  };
  const pub = createPublisher({ env: { INSTAGRAM_ACCESS_TOKEN: TOKEN, META_GRAPH_BASE: "https://graph.test/v1" }, fetchImpl, agenciaRoot: root, sleep: async () => {} });
  return { root, calls, call: (n, a) => pub.tools.find((t) => t.name === n).handler(a) };
}

test("las herramientas de estadísticas son de solo lectura (solo GET a la API)", async () => {
  const m = mundo();
  await m.call("recopilar_estadisticas", { cliente: "demo", mes: "2026-10" });
  assert.ok(m.calls.length > 5);
  assert.ok(m.calls.every((c) => c.method === "GET"));
});

test("recopilar_estadisticas filtra por mes, calcula agregados y guarda el snapshot", async () => {
  const m = mundo();
  const out = JSON.parse(await m.call("recopilar_estadisticas", { cliente: "demo", mes: "2026-10" }));
  assert.equal(out.resumen.total_publicaciones, 2); // la de agosto queda afuera
  assert.equal(out.cuenta.seguidores, 500);
  assert.equal(out.cuenta_periodo.seguidores_netos_periodo, 5);
  assert.equal(out.resumen.por_formato.REEL.alcance_prom, 400);
  assert.equal(out.resumen.por_formato.REEL.tasa_interaccion_media, 20);
  assert.equal(out.resumen.por_formato.REEL.muestra_chica, true);
  assert.equal(out.audiencia.horas_activas["19"], 200);
  assert.equal(out.audiencia.demografia.age["25-34"], 60);
  const file = path.join(m.root, "clientes", "demo", "analisis", "2026-10.datos.json");
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(saved.publicaciones.length, 2);
  assert.equal(saved.publicaciones.find((p) => p.id === "2").retencion_media_seg, 4.2);
  assert.match(fs.readFileSync(path.join(m.root, "clientes", "demo", "registro-actividad.log"), "utf8"), /recopilar_estadisticas.*periodo=2026-10/);
});

test("si Meta rechaza una métrica, sigue con las demás y la informa como hueco de datos", async () => {
  const m = mundo({ rechazar: ["__lista__", "views"] });
  const out = JSON.parse(await m.call("recopilar_estadisticas", { cliente: "demo", mes: "2026-10" }));
  assert.equal(out.resumen.con_metricas, 2);
  assert.ok(Object.keys(out.huecos_de_datos).some((k) => k.endsWith("views")));
});

test("valida entradas: mes, fechas, usuario del competidor y rango de 30 días", async () => {
  const m = mundo();
  await assert.rejects(m.call("recopilar_estadisticas", { cliente: "demo" }), /mes/);
  await assert.rejects(m.call("recopilar_estadisticas", { cliente: "demo", mes: "2026-13" }), /mes/);
  await assert.rejects(m.call("insights_cuenta", { cliente: "demo", desde: "2026-01-01", hasta: "2026-03-01" }), /30 días/);
  await assert.rejects(m.call("insights_cuenta", { cliente: "demo", desde: "ayer", hasta: "hoy" }), /AAAA-MM-DD/);
  await assert.rejects(m.call("benchmark_competidor", { cliente: "demo", usuario: "x){evil" }), /inválido/);
  await assert.rejects(m.call("insights_publicacion", { cliente: "demo", media_id: "1/../2" }), /inválido/);
  await assert.rejects(m.call("perfil_cuenta", { cliente: "../x" }), /cliente inválido/);
});

test("resumirPublicaciones marca muestras chicas y ordena mejores/peores por tasa", () => {
  const mk = (id, tipo, tasa) => ({ id, tipo, dia: "lunes", hora: 20, hashtags: 3, alcance: 100, interacciones: tasa, tasa_interaccion: tasa, guardados: 1, compartidos: 1 });
  const r = resumirPublicaciones([mk("a", "REEL", 10), mk("b", "REEL", 5), mk("c", "REEL", 1), mk("d", "IMAGEN", 7)]);
  assert.equal(r.por_formato.REEL.n, 3);
  assert.equal(r.por_formato.REEL.muestra_chica, false);
  assert.equal(r.por_formato.IMAGEN.muestra_chica, true);
  assert.deepEqual(r.mejores.map((p) => p.id), ["a", "d", "b"]);
  assert.equal(r.peores[0].id, "c");
});

test("tipoDe y diaHora respetan la zona horaria", () => {
  assert.equal(tipoDe({ media_product_type: "REELS", media_type: "VIDEO" }), "REEL");
  assert.equal(tipoDe({ media_type: "CAROUSEL_ALBUM" }), "CARRUSEL");
  assert.deepEqual(diaHora("2026-10-05T22:30:00+0000", "America/Argentina/Buenos_Aires"), { dia: "lunes", hora: 19 });
});
