// Lógica del conector de publicación en Instagram (Instagram Graph API).
// Sin dependencias externas. Segunda barrera de seguridad, independiente del hook:
// solo publica el caption de un .plan.json aprobado, del cliente correcto, una sola vez.
import fs from "node:fs";
import path from "node:path";
import { crearHerramientasInsights } from "./insights.mjs";

const CLIENTE_RE = /^[a-z0-9][a-z0-9-]*$/;
const PLAN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.plan\.json$/;
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4", ".mov": "video/quicktime" };

export class ToolError extends Error {}

export function createPublisher({ env = process.env, fetchImpl = fetch, agenciaRoot, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const graphBase = () => env.META_GRAPH_BASE || `https://graph.facebook.com/${env.META_GRAPH_VERSION || "v23.0"}`;

  function redact(text) {
    let out = String(text);
    for (const [k, v] of Object.entries(env)) {
      if (v && v.length >= 8 && /TOKEN|KEY|SECRET/i.test(k)) out = out.split(v).join("<oculto>");
    }
    return out;
  }

  function checkCliente(cliente) {
    if (typeof cliente !== "string" || !CLIENTE_RE.test(cliente)) throw new ToolError("cliente inválido.");
    const dir = path.join(agenciaRoot, "clientes", cliente);
    if (!fs.existsSync(dir)) throw new ToolError(`no existe clientes/${cliente}/.`);
    return dir;
  }

  function cuenta(cliente) {
    const file = path.join(agenciaRoot, ".claude", "instagram-cuentas.json");
    if (!fs.existsSync(file)) throw new ToolError("falta .claude/instagram-cuentas.json (cliente → ig_user_id).");
    const igUserId = JSON.parse(fs.readFileSync(file, "utf8")).clientes?.[cliente]?.ig_user_id;
    if (!igUserId) throw new ToolError(`'${cliente}' no tiene ig_user_id en instagram-cuentas.json.`);
    const key = `INSTAGRAM_TOKEN_${cliente.toUpperCase().replace(/-/g, "_")}`;
    const token = env[key] || env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) throw new ToolError(`falta la variable de entorno ${key} (o INSTAGRAM_ACCESS_TOKEN).`);
    return { igUserId: String(igUserId), token };
  }

  function cargarPlan(cliente, planName) {
    const dir = checkCliente(cliente);
    if (typeof planName !== "string" || !PLAN_RE.test(planName)) throw new ToolError("nombre de plan inválido (solo el nombre del archivo .plan.json).");
    const file = path.join(dir, "historial", planName);
    if (!fs.existsSync(file)) throw new ToolError(`no existe historial/${planName}.`);
    const plan = JSON.parse(fs.readFileSync(file, "utf8"));
    if (plan.cliente !== cliente) throw new ToolError("el plan pertenece a otro cliente.");
    if (plan.aprobado !== true) throw new ToolError("el plan NO está aprobado.");
    if (fs.existsSync(`${file}.publicado.json`)) throw new ToolError("este plan ya fue publicado.");
    return { plan, file, dir };
  }

  function chequearHorario(plan, ignorar) {
    if (ignorar || !plan.fecha_programada) return;
    const t = Date.parse(plan.fecha_programada);
    if (!Number.isNaN(t) && t - Date.now() > 5 * 60 * 1000) {
      throw new ToolError(`el plan está programado para ${plan.fecha_programada}; la API publica al instante. Usá ignorar_fecha_programada:true solo si querés publicar ahora.`);
    }
  }

  async function graph(method, endpoint, token, params = {}) {
    const url = new URL(`${graphBase()}/${endpoint}`);
    const opts = { method, headers: {} };
    if (method === "GET") {
      for (const [k, v] of Object.entries({ ...params, access_token: token })) url.searchParams.set(k, v);
    } else {
      opts.headers["content-type"] = "application/x-www-form-urlencoded";
      opts.body = new URLSearchParams({ ...params, access_token: token }).toString();
    }
    const res = await fetchImpl(url, opts);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw new ToolError(`Graph API ${res.status}: ${redact(body.error?.message || JSON.stringify(body))}`);
    return body;
  }

  async function esperarContenedor(id, token, { intentos, esperaMs }) {
    for (let i = 0; i < intentos; i++) {
      const s = await graph("GET", id, token, { fields: "status_code,status" });
      if (s.status_code === "FINISHED") return;
      if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new ToolError(`Instagram rechazó el medio (${s.status_code}): ${redact(s.status || "sin detalle")}`);
      await sleep(esperaMs);
    }
    throw new ToolError("Instagram no terminó de procesar el medio a tiempo; reintentá luego (no se publicó nada).");
  }

  function registrar(cliente, dir, planName, info) {
    fs.writeFileSync(path.join(dir, "historial", `${planName}.publicado.json`), JSON.stringify(info, null, 2));
    fs.appendFileSync(path.join(dir, "registro-actividad.log"),
      `[${new Date().toISOString().slice(0, 19).replace("T", " ")}] tool=mcp__instagram__publicar cliente=${cliente} plan=${planName} media_id=${info.media_id}\n`);
  }

  const httpsUrl = (u, nombre) => {
    let p;
    try { p = new URL(u); } catch { throw new ToolError(`${nombre} no es una URL válida.`); }
    if (p.protocol !== "https:") throw new ToolError(`${nombre} debe ser https (Meta descarga el medio desde una URL pública).`);
    return u;
  };

  const listaExportada = (plan) => {
    const a = plan.diseno?.archivo_exportado;
    return Array.isArray(a) ? a : null;
  };

  async function publicar(args, tipo) {
    const { cliente, plan: planName, confirmar = false, ignorar_fecha_programada = false } = args;
    const { plan, file, dir } = cargarPlan(cliente, planName);
    const caption = plan.caption?.instagram;
    if (!caption) throw new ToolError("el plan no tiene caption.instagram.");

    let mediaUrls;
    if (tipo === "carrusel") {
      const urls = args.image_urls;
      if (!Array.isArray(urls) || urls.length < 2 || urls.length > 10) throw new ToolError("image_urls debe ser una lista de 2 a 10 URLs https.");
      mediaUrls = urls.map((u, i) => httpsUrl(u, `image_urls[${i}]`));
      const esperadas = listaExportada(plan);
      if (esperadas && esperadas.length !== mediaUrls.length) {
        throw new ToolError(`el plan tiene ${esperadas.length} placas exportadas pero recibí ${mediaUrls.length} URLs.`);
      }
    } else {
      mediaUrls = [httpsUrl(tipo === "reel" ? args.video_url : args.image_url, tipo === "reel" ? "video_url" : "image_url")];
    }
    chequearHorario(plan, ignorar_fecha_programada);

    const resumen = { cliente, plan: planName, tipo, caption, urls: mediaUrls, fecha_programada: plan.fecha_programada ?? null };
    if (confirmar !== true) {
      return `SIMULACRO (no se publicó nada). Se publicaría en Instagram:\n${JSON.stringify(resumen, null, 2)}\nPara publicar de verdad, repetí la llamada con confirmar:true tras el OK explícito del usuario.`;
    }

    const { igUserId, token } = cuenta(cliente);
    let creationId, hijos;
    if (tipo === "carrusel") {
      hijos = [];
      for (const u of mediaUrls) {
        const h = await graph("POST", `${igUserId}/media`, token, { image_url: u, is_carousel_item: "true" });
        await esperarContenedor(h.id, token, { intentos: 20, esperaMs: 2000 });
        hijos.push(h.id);
      }
      const cont = await graph("POST", `${igUserId}/media`, token, { media_type: "CAROUSEL", children: hijos.join(","), caption });
      creationId = cont.id;
      await esperarContenedor(creationId, token, { intentos: 20, esperaMs: 2000 });
    } else {
      const params = tipo === "reel"
        ? { media_type: "REELS", video_url: mediaUrls[0], caption, share_to_feed: "true", ...(args.cover_url ? { cover_url: httpsUrl(args.cover_url, "cover_url") } : {}) }
        : { image_url: mediaUrls[0], caption };
      const cont = await graph("POST", `${igUserId}/media`, token, params);
      creationId = cont.id;
      await esperarContenedor(creationId, token, tipo === "reel" ? { intentos: 60, esperaMs: 5000 } : { intentos: 20, esperaMs: 2000 });
    }
    const pub = await graph("POST", `${igUserId}/media_publish`, token, { creation_id: creationId });
    const info = await graph("GET", pub.id, token, { fields: "permalink" }).catch(() => ({}));
    const registro = { fecha: new Date().toISOString(), tipo, creation_id: creationId, ...(hijos ? { hijos } : {}), media_id: pub.id, permalink: info.permalink ?? null };
    registrar(cliente, dir, path.basename(file), registro);
    return `PUBLICADO en Instagram. media_id=${pub.id}${info.permalink ? ` · ${info.permalink}` : ""}`;
  }

  // Historias: la API solo acepta imagen o video (sin caption, stickers, encuestas ni links).
  // Un plan = una secuencia de 1 a 10 historias, publicadas una tras otra.
  async function publicarHistoria(args) {
    const { cliente, plan: planName, items, confirmar = false, ignorar_fecha_programada = false } = args;
    const { plan, file, dir } = cargarPlan(cliente, planName);
    if (plan.formato !== "historia") throw new ToolError("el plan no es de formato 'historia'.");
    if (plan.publicacion === "manual") throw new ToolError("este plan está marcado para publicación manual (usa stickers, encuestas o links que la API no soporta).");
    if (!Array.isArray(items) || items.length < 1 || items.length > 10) throw new ToolError("items debe ser una lista de 1 a 10 historias {tipo, url}.");
    if (Array.isArray(plan.historias) && plan.historias.length !== items.length) {
      throw new ToolError(`el plan tiene ${plan.historias.length} historias pero recibí ${items.length} items.`);
    }
    const norm = items.map((it, i) => {
      if (!["imagen", "video"].includes(it?.tipo)) throw new ToolError(`items[${i}].tipo debe ser 'imagen' o 'video'.`);
      return { tipo: it.tipo, url: httpsUrl(it.url, `items[${i}].url`) };
    });
    chequearHorario(plan, ignorar_fecha_programada);

    if (confirmar !== true) {
      return `SIMULACRO (no se publicó nada). Se publicarían ${norm.length} historia(s) en Instagram, en este orden:\n${JSON.stringify({ cliente, plan: planName, items: norm, fecha_programada: plan.fecha_programada ?? null }, null, 2)}\nLas historias duran 24 h y la API no agrega stickers ni links. Para publicar de verdad, repetí la llamada con confirmar:true tras el OK explícito del usuario.`;
    }

    const { igUserId, token } = cuenta(cliente);
    const publicadas = [];
    try {
      for (const it of norm) {
        const params = { media_type: "STORIES", ...(it.tipo === "video" ? { video_url: it.url } : { image_url: it.url }) };
        const cont = await graph("POST", `${igUserId}/media`, token, params);
        await esperarContenedor(cont.id, token, it.tipo === "video" ? { intentos: 60, esperaMs: 5000 } : { intentos: 20, esperaMs: 2000 });
        const pub = await graph("POST", `${igUserId}/media_publish`, token, { creation_id: cont.id });
        publicadas.push({ tipo: it.tipo, creation_id: cont.id, media_id: pub.id });
      }
    } catch (e) {
      if (publicadas.length === 0) throw e;
      registrar(cliente, dir, path.basename(file), { fecha: new Date().toISOString(), tipo: "historia", parcial: true, historias: publicadas, media_id: publicadas.map((p) => p.media_id).join(",") });
      throw new ToolError(`Se publicaron ${publicadas.length} de ${norm.length} historias antes del error: ${e.message}. El plan quedó registrado como PARCIAL y no se puede reintentar completo (duplicaría historias): publicá el resto a mano.`);
    }
    registrar(cliente, dir, path.basename(file), { fecha: new Date().toISOString(), tipo: "historia", historias: publicadas, media_id: publicadas.map((p) => p.media_id).join(",") });
    return `PUBLICADAS ${publicadas.length} historia(s) en Instagram. media_id=${publicadas.map((p) => p.media_id).join(",")} (duran 24 h)`;
  }

  async function subirUno(archivo, cliente, bucket) {
    const mime = MIME[path.extname(archivo).toLowerCase()];
    if (!mime) throw new ToolError("tipo de archivo no soportado (png, jpg, mp4, mov).");
    const nombre = `${cliente}/${path.basename(archivo).replace(/[^A-Za-z0-9._-]/g, "_")}`;

    // Vercel Blob (recomendado): token acotado a un único store, URL con sufijo aleatorio.
    if (env.BLOB_READ_WRITE_TOKEN) {
      const res = await fetchImpl(`${env.BLOB_API_URL || "https://blob.vercel-storage.com"}/${nombre}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${env.BLOB_READ_WRITE_TOKEN}`, "x-api-version": env.BLOB_API_VERSION || "7",
          "x-content-type": mime, "x-add-random-suffix": "1" },
        body: fs.readFileSync(archivo),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) throw new ToolError(`Vercel Blob ${res.status}: ${redact(body.error?.message || JSON.stringify(body))}`);
      return body.url;
    }

    const base = env.SUPABASE_URL, key = env.SUPABASE_KEY;
    if (!base || !key) throw new ToolError("falta BLOB_READ_WRITE_TOKEN (Vercel Blob) o SUPABASE_URL y SUPABASE_KEY.");
    const res = await fetchImpl(`${base}/storage/v1/object/${bucket}/${nombre}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": mime, "x-upsert": "true" },
      body: fs.readFileSync(archivo),
    });
    if (!res.ok) throw new ToolError(`Supabase ${res.status}: ${redact(await res.text())}`);
    return `${base}/storage/v1/object/public/${bucket}/${nombre}`;
  }

  async function subir(args) {
    const { cliente, plan: planName, bucket = "publicaciones" } = args;
    const { plan, dir } = cargarPlan(cliente, planName);
    const deHistorias = Array.isArray(plan.historias) ? plan.historias.map((h) => h?.archivo).filter(Boolean) : [];
    const rels = deHistorias.length ? deHistorias : listaExportada(plan) || [plan.diseno?.archivo_exportado || plan.video].filter(Boolean);
    if (rels.length === 0) throw new ToolError("el plan no tiene diseno.archivo_exportado ni video para subir.");
    if (!/^[a-z0-9-]+$/.test(bucket)) throw new ToolError("bucket inválido.");

    const archivos = rels.map((rel) => {
      const archivo = path.resolve(dir, rel);
      if (!archivo.startsWith(path.join(dir, "assets") + path.sep)) throw new ToolError("un archivo del plan está fuera de assets/.");
      if (!fs.existsSync(archivo)) throw new ToolError(`no existe ${rel}.`);
      return archivo;
    });
    const urls = [];
    for (const a of archivos) urls.push(await subirUno(a, cliente, bucket));
    return urls.length === 1
      ? `Subido. URL pública: ${urls[0]}`
      : `Subidos ${urls.length} archivos. URLs públicas (en orden de placa):\n${urls.join("\n")}`;
  }

  async function verCuenta({ cliente }) {
    checkCliente(cliente);
    const { igUserId, token } = cuenta(cliente);
    const c = await graph("GET", igUserId, token, { fields: "username,name" });
    const lim = await graph("GET", `${igUserId}/content_publishing_limit`, token, { fields: "quota_usage,config" }).catch(() => null);
    return JSON.stringify({ cuenta: c, limite_publicacion: lim?.data?.[0] ?? null }, null, 2);
  }

  const planProp = { type: "string", description: "Nombre del archivo .plan.json aprobado en clientes/<cliente>/historial/." };
  const clienteProp = { type: "string", description: "Carpeta del cliente en clientes/." };
  const comunes = { confirmar: { type: "boolean" }, ignorar_fecha_programada: { type: "boolean" } };
  const tools = [
    { name: "ver_cuenta", description: "Muestra la cuenta de Instagram conectada del cliente y su cuota de publicación. Solo lectura.",
      inputSchema: { type: "object", properties: { cliente: clienteProp }, required: ["cliente"] }, handler: verCuenta },
    { name: "subir_archivo_publico", description: "Sube a Vercel Blob (o Supabase Storage) el/los archivo(s) exportado(s) (diseno.archivo_exportado, una lista para carruseles, o video) de un plan APROBADO y devuelve sus URLs públicas, que Instagram necesita para descargarlos.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, plan: planProp, bucket: { type: "string" } }, required: ["cliente", "plan"] }, handler: subir },
    { name: "publicar_imagen", description: "Publica una imagen en Instagram usando el caption del plan APROBADO. Sin confirmar:true solo simula. Requiere OK explícito del usuario para esa pieza.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, plan: planProp, image_url: { type: "string", description: "URL https pública de la imagen." }, ...comunes }, required: ["cliente", "plan", "image_url"] },
      handler: (a) => publicar(a, "imagen") },
    { name: "publicar_carrusel", description: "Publica un carrusel (2 a 10 imágenes) en Instagram usando el caption del plan APROBADO. image_urls va en el orden de las placas. Sin confirmar:true solo simula. Requiere OK explícito del usuario para esa pieza.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, plan: planProp, image_urls: { type: "array", items: { type: "string" }, description: "URLs https públicas, en orden." }, ...comunes }, required: ["cliente", "plan", "image_urls"] },
      handler: (a) => publicar(a, "carrusel") },
    { name: "publicar_historia", description: "Publica una secuencia de 1 a 10 historias (imagen o video, en orden) de un plan APROBADO de formato 'historia'. La API no admite stickers, encuestas ni links: las historias que los necesiten van en un plan con publicacion:'manual', que se rechaza acá. Sin confirmar:true solo simula. Requiere OK explícito del usuario para esa pieza.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, plan: planProp, items: { type: "array", description: "Historias en orden: [{tipo:'imagen'|'video', url:'https://...'}].", items: { type: "object", properties: { tipo: { type: "string", enum: ["imagen", "video"] }, url: { type: "string" } }, required: ["tipo", "url"] } }, ...comunes }, required: ["cliente", "plan", "items"] },
      handler: publicarHistoria },
    { name: "publicar_reel", description: "Publica un Reel en Instagram usando el caption del plan APROBADO. Sin confirmar:true solo simula. Requiere OK explícito del usuario para esa pieza.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, plan: planProp, video_url: { type: "string" }, cover_url: { type: "string" }, ...comunes }, required: ["cliente", "plan", "video_url"] },
      handler: (a) => publicar(a, "reel") },
  ];
  tools.push(...crearHerramientasInsights({ graph, cuenta, checkCliente, agenciaRoot, ToolError, env }));
  return { tools };
}
