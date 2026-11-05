import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPublisher } from "./publisher.mjs";
import { handleMessage } from "./server.mjs";

const TOKEN = "EAAB-token-secreto-de-prueba-123456";

function mundo({ plan = {}, planName = "2026-11-03-demo.plan.json", cliente = "demo", env = {}, graph } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ig-pub-"));
  const dir = path.join(root, "clientes", cliente);
  fs.mkdirSync(path.join(dir, "historial"), { recursive: true });
  fs.mkdirSync(path.join(dir, "assets", "exports"), { recursive: true });
  fs.writeFileSync(path.join(dir, "assets", "exports", "pieza.png"), "png-bytes");
  fs.mkdirSync(path.join(root, ".claude"));
  fs.writeFileSync(path.join(root, ".claude", "instagram-cuentas.json"), JSON.stringify({ clientes: { demo: { ig_user_id: "1789" } } }));
  const planObj = { cliente, aprobado: true, caption: { instagram: "Caption aprobado #pilates" },
    diseno: { archivo_exportado: "assets/exports/pieza.png" }, fecha_programada: "2020-01-01T10:00:00-03:00", ...plan };
  fs.writeFileSync(path.join(dir, "historial", planName), JSON.stringify(planObj));
  const calls = [];
  const defaultGraph = (u, o) => {
    if (o.method === "POST" && u.pathname.endsWith("/media")) return { id: "C1" };
    if (u.pathname.endsWith("/C1")) return { status_code: "FINISHED" };
    if (u.pathname.endsWith("/media_publish")) return { id: "M1" };
    if (u.pathname.endsWith("/M1")) return { permalink: "https://instagram.com/p/abc" };
    if (u.pathname.endsWith("/content_publishing_limit")) return { data: [{ quota_usage: 2 }] };
    if (u.pathname.endsWith("/1789")) return { id: "1789", username: "lumbre.pilates" };
    return { error: { message: "no mock" } };
  };
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    calls.push({ method: opts.method, path: u.pathname, body: opts.body ? String(opts.body) : "", url: String(url) });
    const out = (graph || defaultGraph)(u, opts, calls);
    const status = out.__status || (out.error ? 400 : 200);
    return { ok: status < 400, status, json: async () => out, text: async () => JSON.stringify(out) };
  };
  const pub = createPublisher({ env: { INSTAGRAM_ACCESS_TOKEN: TOKEN, META_GRAPH_BASE: "https://graph.test/v1", ...env }, fetchImpl, agenciaRoot: root, sleep: async () => {} });
  const call = (name, args) => pub.tools.find((t) => t.name === name).handler(args);
  return { root, dir, calls, call, pub, planName };
}

const args = (m, extra = {}) => ({ cliente: "demo", plan: m.planName, image_url: "https://cdn.test/pieza.png", ...extra });

test("sin confirmar es un simulacro: no llama a la API", async () => {
  const m = mundo();
  const out = await m.call("publicar_imagen", args(m));
  assert.match(out, /SIMULACRO/);
  assert.equal(m.calls.length, 0);
});

test("publica con confirmar:true usando el caption del PLAN y registra el resultado", async () => {
  const m = mundo();
  const out = await m.call("publicar_imagen", args(m, { confirmar: true }));
  assert.match(out, /PUBLICADO.*M1/);
  const post = m.calls.find((c) => c.method === "POST" && c.path.endsWith("/1789/media"));
  assert.match(decodeURIComponent(post.body.replace(/\+/g, " ")), /caption=Caption aprobado #pilates/);
  assert.ok(fs.existsSync(path.join(m.dir, "historial", `${m.planName}.publicado.json`)));
  assert.match(fs.readFileSync(path.join(m.dir, "registro-actividad.log"), "utf8"), /media_id=M1/);
});

test("no permite publicar dos veces el mismo plan", async () => {
  const m = mundo();
  await m.call("publicar_imagen", args(m, { confirmar: true }));
  await assert.rejects(m.call("publicar_imagen", args(m, { confirmar: true })), /ya fue publicado/);
});

test("rechaza un plan no aprobado", async () => {
  const m = mundo({ plan: { aprobado: false } });
  await assert.rejects(m.call("publicar_imagen", args(m, { confirmar: true })), /NO está aprobado/);
  assert.equal(m.calls.length, 0);
});

test("rechaza un plan que pertenece a otro cliente", async () => {
  const m = mundo({ plan: { cliente: "otro" } });
  await assert.rejects(m.call("publicar_imagen", args(m, { confirmar: true })), /otro cliente/);
});

test("rechaza nombres de plan y de cliente con path traversal", async () => {
  const m = mundo();
  await assert.rejects(m.call("publicar_imagen", args(m, { plan: "../x.plan.json" })), /inválido/);
  await assert.rejects(m.call("publicar_imagen", args(m, { cliente: "..\\demo" })), /inválido/);
});

test("exige https en image_url", async () => {
  const m = mundo();
  await assert.rejects(m.call("publicar_imagen", args(m, { image_url: "http://x/y.png" })), /https/);
});

test("no publica antes de la fecha programada salvo ignorar_fecha_programada", async () => {
  const futuro = new Date(Date.now() + 3 * 3600e3).toISOString();
  const m = mundo({ plan: { fecha_programada: futuro } });
  await assert.rejects(m.call("publicar_imagen", args(m, { confirmar: true })), /programado/);
  const out = await m.call("publicar_imagen", args(m, { confirmar: true, ignorar_fecha_programada: true }));
  assert.match(out, /PUBLICADO/);
});

test("espera a que el contenedor termine (IN_PROGRESS → FINISHED)", async () => {
  let n = 0;
  const m = mundo({ graph: (u, o) => {
    if (o.method === "POST" && u.pathname.endsWith("/media")) return { id: "C1" };
    if (u.pathname.endsWith("/C1")) return { status_code: ++n < 3 ? "IN_PROGRESS" : "FINISHED" };
    if (u.pathname.endsWith("/media_publish")) return { id: "M1" };
    return { permalink: "https://instagram.com/p/x" };
  } });
  assert.match(await m.call("publicar_imagen", args(m, { confirmar: true })), /PUBLICADO/);
  assert.equal(n, 3);
});

test("si Instagram devuelve ERROR no publica ni registra", async () => {
  const m = mundo({ graph: (u, o) => {
    if (o.method === "POST" && u.pathname.endsWith("/media")) return { id: "C1" };
    return { status_code: "ERROR", status: "formato no soportado" };
  } });
  await assert.rejects(m.call("publicar_imagen", args(m, { confirmar: true })), /rechazó/);
  assert.ok(!m.calls.some((c) => c.path.endsWith("/media_publish")));
  assert.ok(!fs.existsSync(path.join(m.dir, "historial", `${m.planName}.publicado.json`)));
});

test("el token nunca aparece en errores", async () => {
  const m = mundo({ graph: () => ({ error: { message: `token inválido ${TOKEN}` }, __status: 401 }) });
  await assert.rejects(m.call("publicar_imagen", args(m, { confirmar: true })), (e) => !e.message.includes(TOKEN) && /oculto/.test(e.message));
});

test("sin token falla con mensaje claro", async () => {
  const m = mundo({ env: { INSTAGRAM_ACCESS_TOKEN: "" } });
  await assert.rejects(m.call("publicar_imagen", args(m, { confirmar: true })), /falta la variable/);
});

test("publicar_reel crea un contenedor REELS", async () => {
  const m = mundo();
  const out = await m.call("publicar_reel", { cliente: "demo", plan: m.planName, video_url: "https://cdn.test/v.mp4", confirmar: true });
  assert.match(out, /PUBLICADO/);
  const post = m.calls.find((c) => c.method === "POST" && c.path.endsWith("/1789/media"));
  assert.match(post.body, /media_type=REELS/);
});

function mundoCarrusel(extra = {}) {
  let n = 0;
  const m = mundo({
    plan: { diseno: { archivo_exportado: ["assets/exports/p1.png", "assets/exports/p2.png"] } },
    graph: (u, o) => {
      if (o.method === "POST" && u.pathname.endsWith("/1789/media")) {
        const body = new URLSearchParams(String(o.body));
        return { id: body.get("media_type") === "CAROUSEL" ? "CAR" : `H${++n}` };
      }
      if (/\/(H1|H2|CAR)$/.test(u.pathname)) return { status_code: "FINISHED" };
      if (u.pathname.endsWith("/media_publish")) return { id: "M9" };
      if (u.pathname.endsWith("/M9")) return { permalink: "https://instagram.com/p/car" };
      return { error: { message: "no mock" } };
    },
    ...extra,
  });
  fs.writeFileSync(path.join(m.dir, "assets", "exports", "p1.png"), "a");
  fs.writeFileSync(path.join(m.dir, "assets", "exports", "p2.png"), "b");
  return m;
}
const urlsCar = ["https://cdn.test/p1.png", "https://cdn.test/p2.png"];

test("publicar_carrusel sin confirmar es simulacro", async () => {
  const m = mundoCarrusel();
  const out = await m.call("publicar_carrusel", { cliente: "demo", plan: m.planName, image_urls: urlsCar });
  assert.match(out, /SIMULACRO/);
  assert.equal(m.calls.length, 0);
});

test("publicar_carrusel: crea hijos, luego el carrusel con children en orden, y publica", async () => {
  const m = mundoCarrusel();
  const out = await m.call("publicar_carrusel", { cliente: "demo", plan: m.planName, image_urls: urlsCar, confirmar: true });
  assert.match(out, /PUBLICADO.*M9/);
  const posts = m.calls.filter((c) => c.method === "POST");
  assert.equal(posts.length, 4); // 2 hijos + carrusel + media_publish
  assert.match(posts[0].body, /is_carousel_item=true/);
  assert.match(posts[0].body, /p1\.png/);
  assert.match(posts[1].body, /p2\.png/);
  const car = new URLSearchParams(posts[2].body);
  assert.equal(car.get("media_type"), "CAROUSEL");
  assert.equal(car.get("children"), "H1,H2");
  assert.equal(car.get("caption"), "Caption aprobado #pilates");
  assert.match(posts[3].path, /media_publish$/);
  const reg = JSON.parse(fs.readFileSync(path.join(m.dir, "historial", `${m.planName}.publicado.json`), "utf8"));
  assert.deepEqual(reg.hijos, ["H1", "H2"]);
});

test("publicar_carrusel valida cantidad (2 a 10) y que coincida con las placas del plan", async () => {
  const m = mundoCarrusel();
  await assert.rejects(m.call("publicar_carrusel", { cliente: "demo", plan: m.planName, image_urls: [urlsCar[0]] }), /2 a 10/);
  await assert.rejects(m.call("publicar_carrusel", { cliente: "demo", plan: m.planName, image_urls: [...urlsCar, "https://cdn.test/p3.png"] }), /2 placas exportadas pero recibí 3/);
  await assert.rejects(m.call("publicar_carrusel", { cliente: "demo", plan: m.planName, image_urls: ["http://x/a.png", "https://x/b.png"] }), /https/);
});

test("publicar_carrusel: si un hijo falla, no se crea el carrusel ni se publica", async () => {
  const m = mundoCarrusel({ graph: (u, o) => {
    if (o.method === "POST" && u.pathname.endsWith("/1789/media")) return { id: "H1" };
    return { status_code: "ERROR", status: "imagen inválida" };
  } });
  await assert.rejects(m.call("publicar_carrusel", { cliente: "demo", plan: m.planName, image_urls: urlsCar, confirmar: true }), /rechazó/);
  assert.ok(!m.calls.some((c) => c.path.endsWith("/media_publish")));
  assert.ok(!fs.existsSync(path.join(m.dir, "historial", `${m.planName}.publicado.json`)));
});

test("subir_archivo_publico sube todas las placas de un carrusel en orden", async () => {
  let i = 0;
  const m = mundoCarrusel({ env: { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_token_de_prueba_123456", BLOB_API_URL: "https://blob.test" },
    graph: () => ({ url: `https://s.public.blob.vercel-storage.com/demo/placa-${++i}.png` }) });
  const out = await m.call("subir_archivo_publico", { cliente: "demo", plan: m.planName });
  assert.match(out, /Subidos 2 archivos/);
  assert.deepEqual(out.split("\n").slice(1), ["https://s.public.blob.vercel-storage.com/demo/placa-1.png", "https://s.public.blob.vercel-storage.com/demo/placa-2.png"]);
  assert.deepEqual(m.calls.map((c) => c.path), ["/demo/p1.png", "/demo/p2.png"]);
});

test("subir_archivo_publico sube solo el archivo exportado del plan aprobado", async () => {
  const m = mundo({ env: { SUPABASE_URL: "https://sb.test", SUPABASE_KEY: "clave-supabase-123456" }, graph: () => ({}) });
  const out = await m.call("subir_archivo_publico", { cliente: "demo", plan: m.planName });
  assert.equal(out, "Subido. URL pública: https://sb.test/storage/v1/object/public/publicaciones/demo/pieza.png");
  assert.equal(m.calls[0].method, "POST");
});

test("subir_archivo_publico usa Vercel Blob cuando hay BLOB_READ_WRITE_TOKEN", async () => {
  const BT = "vercel_blob_rw_token_de_prueba_123456";
  const m = mundo({ env: { BLOB_READ_WRITE_TOKEN: BT, BLOB_API_URL: "https://blob.test" },
    graph: () => ({ url: "https://abc123.public.blob.vercel-storage.com/demo/pieza-Xk29.png" }) });
  const out = await m.call("subir_archivo_publico", { cliente: "demo", plan: m.planName });
  assert.equal(out, "Subido. URL pública: https://abc123.public.blob.vercel-storage.com/demo/pieza-Xk29.png");
  assert.equal(m.calls[0].method, "PUT");
  assert.equal(m.calls[0].path, "/demo/pieza.png");
});

test("subir_archivo_publico: el token de Blob no aparece en errores", async () => {
  const BT = "vercel_blob_rw_token_de_prueba_123456";
  const m = mundo({ env: { BLOB_READ_WRITE_TOKEN: BT, BLOB_API_URL: "https://blob.test" },
    graph: () => ({ error: { message: `no autorizado ${BT}` }, __status: 403 }) });
  await assert.rejects(m.call("subir_archivo_publico", { cliente: "demo", plan: m.planName }), (e) => !e.message.includes(BT) && /oculto/.test(e.message));
});

test("subir_archivo_publico bloquea archivos fuera de assets/", async () => {
  const m = mundo({ plan: { diseno: { archivo_exportado: "perfil.md" } }, env: { SUPABASE_URL: "https://sb.test", SUPABASE_KEY: "clave-supabase-123456" } });
  fs.writeFileSync(path.join(m.dir, "perfil.md"), "secreto");
  await assert.rejects(m.call("subir_archivo_publico", { cliente: "demo", plan: m.planName }), /fuera de assets/);
});

test("ver_cuenta devuelve usuario y cuota", async () => {
  const m = mundo();
  const out = JSON.parse(await m.call("ver_cuenta", { cliente: "demo" }));
  assert.equal(out.cuenta.username, "lumbre.pilates");
  assert.equal(out.limite_publicacion.quota_usage, 2);
});

test("protocolo MCP: initialize, tools/list y error de herramienta como isError", async () => {
  const m = mundo();
  const init = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, m.pub);
  assert.equal(init.result.serverInfo.name, "instagram-publisher");
  const list = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, m.pub);
  assert.deepEqual(list.result.tools.map((t) => t.name).sort(), ["publicar_carrusel", "publicar_imagen", "publicar_reel", "subir_archivo_publico", "ver_cuenta"]);
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, m.pub), null);
  const bad = await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "publicar_imagen", arguments: { cliente: "demo", plan: "../x.plan.json", image_url: "https://a/b.png" } } }, m.pub);
  assert.equal(bad.result.isError, true);
});
