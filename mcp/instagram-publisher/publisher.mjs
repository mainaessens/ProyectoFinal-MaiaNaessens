// Lógica del conector de publicación en Instagram (Instagram Graph API).
// Sin dependencias externas. Segunda barrera de seguridad, independiente del hook:
// solo publica el caption de un .plan.json aprobado, del cliente correcto, una sola vez.
import fs from "node:fs";
import path from "node:path";

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

  async function publicar(args, tipo) {
    const { cliente, plan: planName, confirmar = false, ignorar_fecha_programada = false } = args;
    const { plan, file, dir } = cargarPlan(cliente, planName);
    const caption = plan.caption?.instagram;
    if (!caption) throw new ToolError("el plan no tiene caption.instagram.");
    const mediaUrl = httpsUrl(tipo === "reel" ? args.video_url : args.image_url, tipo === "reel" ? "video_url" : "image_url");
    chequearHorario(plan, ignorar_fecha_programada);

    const resumen = { cliente, plan: planName, tipo, caption, url: mediaUrl, fecha_programada: plan.fecha_programada ?? null };
    if (confirmar !== true) {
      return `SIMULACRO (no se publicó nada). Se publicaría en Instagram:\n${JSON.stringify(resumen, null, 2)}\nPara publicar de verdad, repetí la llamada con confirmar:true tras el OK explícito del usuario.`;
    }

    const { igUserId, token } = cuenta(cliente);
    const params = tipo === "reel"
      ? { media_type: "REELS", video_url: mediaUrl, caption, share_to_feed: "true", ...(args.cover_url ? { cover_url: httpsUrl(args.cover_url, "cover_url") } : {}) }
      : { image_url: mediaUrl, caption };
    const cont = await graph("POST", `${igUserId}/media`, token, params);
    await esperarContenedor(cont.id, token, tipo === "reel" ? { intentos: 60, esperaMs: 5000 } : { intentos: 20, esperaMs: 2000 });
    const pub = await graph("POST", `${igUserId}/media_publish`, token, { creation_id: cont.id });
    const info = await graph("GET", pub.id, token, { fields: "permalink" }).catch(() => ({}));
    const registro = { fecha: new Date().toISOString(), tipo, creation_id: cont.id, media_id: pub.id, permalink: info.permalink ?? null };
    registrar(cliente, dir, path.basename(file), registro);
    return `PUBLICADO en Instagram. media_id=${pub.id}${info.permalink ? ` · ${info.permalink}` : ""}`;
  }

  async function subir(args) {
    const { cliente, plan: planName, bucket = "publicaciones" } = args;
    const { plan, dir } = cargarPlan(cliente, planName);
    const rel = plan.diseno?.archivo_exportado || plan.video;
    if (!rel) throw new ToolError("el plan no tiene diseno.archivo_exportado ni video para subir.");
    const archivo = path.resolve(dir, rel);
    if (!archivo.startsWith(path.join(dir, "assets") + path.sep)) throw new ToolError("el archivo del plan está fuera de assets/.");
    if (!fs.existsSync(archivo)) throw new ToolError(`no existe ${rel}.`);
    const mime = MIME[path.extname(archivo).toLowerCase()];
    if (!mime) throw new ToolError("tipo de archivo no soportado (png, jpg, mp4, mov).");
    if (!/^[a-z0-9-]+$/.test(bucket)) throw new ToolError("bucket inválido.");
    const base = env.SUPABASE_URL, key = env.SUPABASE_KEY;
    if (!base || !key) throw new ToolError("faltan SUPABASE_URL y/o SUPABASE_KEY.");
    const nombre = `${cliente}/${path.basename(archivo).replace(/[^A-Za-z0-9._-]/g, "_")}`;
    const res = await fetchImpl(`${base}/storage/v1/object/${bucket}/${nombre}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": mime, "x-upsert": "true" },
      body: fs.readFileSync(archivo),
    });
    if (!res.ok) throw new ToolError(`Supabase ${res.status}: ${redact(await res.text())}`);
    return `Subido. URL pública: ${base}/storage/v1/object/public/${bucket}/${nombre}`;
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
  const tools = [
    { name: "ver_cuenta", description: "Muestra la cuenta de Instagram conectada del cliente y su cuota de publicación. Solo lectura.",
      inputSchema: { type: "object", properties: { cliente: clienteProp }, required: ["cliente"] }, handler: verCuenta },
    { name: "subir_archivo_publico", description: "Sube a Supabase Storage el archivo exportado (diseno.archivo_exportado o video) de un plan APROBADO y devuelve su URL pública, que Instagram necesita para descargarlo.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, plan: planProp, bucket: { type: "string" } }, required: ["cliente", "plan"] }, handler: subir },
    { name: "publicar_imagen", description: "Publica una imagen en Instagram usando el caption del plan APROBADO. Sin confirmar:true solo simula. Requiere OK explícito del usuario para esa pieza.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, plan: planProp, image_url: { type: "string", description: "URL https pública de la imagen." }, confirmar: { type: "boolean" }, ignorar_fecha_programada: { type: "boolean" } }, required: ["cliente", "plan", "image_url"] },
      handler: (a) => publicar(a, "imagen") },
    { name: "publicar_reel", description: "Publica un Reel en Instagram usando el caption del plan APROBADO. Sin confirmar:true solo simula. Requiere OK explícito del usuario para esa pieza.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, plan: planProp, video_url: { type: "string" }, cover_url: { type: "string" }, confirmar: { type: "boolean" }, ignorar_fecha_programada: { type: "boolean" } }, required: ["cliente", "plan", "video_url"] },
      handler: (a) => publicar(a, "reel") },
  ];
  return { tools };
}
