// Herramientas de ESTADÍSTICAS del conector de Instagram (Instagram Graph API).
// Todas son de SOLO LECTURA: nunca publican ni modifican la cuenta. La única escritura es
// el snapshot local clientes/<cliente>/analisis/<periodo>.datos.json de `recopilar_estadisticas`.
// Requieren el permiso instagram_manage_insights en el token (ver docs/conectar-instagram.md).
import fs from "node:fs";
import path from "node:path";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const USUARIO_RE = /^[A-Za-z0-9._]{1,30}$/;
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MUESTRA_MIN = 3; // por debajo de esto, un promedio no es una conclusión

const METRICAS_MEDIA = {
  REEL: ["reach", "saved", "shares", "likes", "comments", "total_interactions", "views", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"],
  OTRO: ["reach", "saved", "shares", "likes", "comments", "total_interactions", "views"],
};
const METRICAS_CUENTA = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "saves", "shares", "follows_and_unfollows", "profile_links_taps"];

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);
const unix = (iso) => Math.floor(Date.parse(iso) / 1000);

export function tipoDe(m) {
  if (m.media_product_type === "REELS") return "REEL";
  if (m.media_type === "CAROUSEL_ALBUM") return "CARRUSEL";
  if (m.media_type === "VIDEO") return "VIDEO";
  return "IMAGEN";
}

export function diaHora(iso, tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { dia: DIAS[WD[get("weekday")]], hora: Number(get("hour")) };
}

export function franja(h) {
  return h < 6 ? "madrugada (0-6)" : h < 12 ? "mañana (6-12)" : h < 15 ? "mediodía (12-15)" : h < 19 ? "tarde (15-19)" : h < 22 ? "noche (19-22)" : "noche tarde (22-24)";
}

function agrupar(posts, keyFn) {
  const grupos = {};
  for (const p of posts) (grupos[keyFn(p)] ||= []).push(p);
  const out = {};
  for (const [k, ps] of Object.entries(grupos)) {
    const conAlcance = ps.filter((p) => p.alcance > 0 && p.tasa_interaccion !== null);
    out[k] = {
      n: ps.length,
      alcance_prom: r2(media(ps.map((p) => p.alcance).filter((v) => v !== null))),
      interacciones_prom: r2(media(ps.map((p) => p.interacciones).filter((v) => v !== null))),
      guardados_prom: r2(media(ps.map((p) => p.guardados).filter((v) => v !== null))),
      compartidos_prom: r2(media(ps.map((p) => p.compartidos).filter((v) => v !== null))),
      tasa_interaccion_media: r2(media(conAlcance.map((p) => p.tasa_interaccion))),
      muestra_chica: ps.length < MUESTRA_MIN,
    };
  }
  return out;
}

/** Agregados determinísticos: el LLM interpreta, pero los números salen de acá. */
export function resumirPublicaciones(posts) {
  const medibles = posts.filter((p) => p.alcance > 0 && p.tasa_interaccion !== null);
  const orden = [...medibles].sort((a, b) => b.tasa_interaccion - a.tasa_interaccion);
  const brief = (p) => ({ id: p.id, tipo: p.tipo, fecha: p.fecha, permalink: p.permalink, alcance: p.alcance, tasa_interaccion: p.tasa_interaccion, caption_inicio: p.caption_inicio });
  const hashtagsPorTasa = agrupar(medibles, (p) => (p.hashtags === 0 ? "0" : p.hashtags <= 5 ? "1-5" : p.hashtags <= 10 ? "6-10" : "11+"));
  return {
    total_publicaciones: posts.length,
    con_metricas: medibles.length,
    por_formato: agrupar(posts, (p) => p.tipo),
    por_dia_semana: agrupar(posts, (p) => p.dia),
    por_franja_horaria: agrupar(posts, (p) => franja(p.hora)),
    por_cantidad_hashtags: hashtagsPorTasa,
    mejores: orden.slice(0, 3).map(brief),
    peores: orden.slice(-3).reverse().map(brief),
    nota_muestra: `Los grupos con n < ${MUESTRA_MIN} están marcados muestra_chica: no sacar conclusiones firmes de ellos.`,
  };
}

export function crearHerramientasInsights({ graph, cuenta, checkCliente, agenciaRoot, ToolError, env = process.env }) {
  const TZ = env.INSTAGRAM_TZ || "America/Argentina/Buenos_Aires";
  const clienteProp = { type: "string", description: "Carpeta del cliente en clientes/." };

  const fechaArg = (v, nombre) => {
    if (typeof v !== "string" || !FECHA_RE.test(v) || Number.isNaN(Date.parse(v))) throw new ToolError(`${nombre} debe ser AAAA-MM-DD.`);
    return v;
  };
  const rango = (desde, hasta) => {
    const d = fechaArg(desde, "desde"), h = fechaArg(hasta, "hasta");
    if (Date.parse(h) < Date.parse(d)) throw new ToolError("hasta es anterior a desde.");
    return { since: unix(`${d}T00:00:00Z`), until: unix(`${h}T23:59:59Z`), desde: d, hasta: h };
  };
  const limitarRango = (r) => {
    if (r.until - r.since > 31 * 86400) throw new ToolError("insights de cuenta admite como máximo 30 días por consulta (usá recopilar_estadisticas para períodos largos).");
    return r;
  };

  /** Pide varias métricas juntas; si Meta rechaza alguna, reintenta una por una y reporta cuáles no están disponibles. */
  async function metricas(endpoint, token, lista, extra = {}) {
    const valor = (d) => d.total_value?.value ?? d.values?.[0]?.value ?? null;
    try {
      const r = await graph("GET", endpoint, token, { metric: lista.join(","), ...extra });
      return { valores: Object.fromEntries((r.data || []).map((d) => [d.name, valor(d)])), no_disponibles: {} };
    } catch {
      const valores = {}, no_disponibles = {};
      for (const m of lista) {
        try {
          const r = await graph("GET", endpoint, token, { metric: m, ...extra });
          valores[m] = r.data?.[0] ? valor(r.data[0]) : null;
        } catch (e) { no_disponibles[m] = e.message.slice(0, 160); }
      }
      return { valores, no_disponibles };
    }
  }

  const ig = (cliente) => { checkCliente(cliente); return cuenta(cliente); };

  async function perfilCuenta({ cliente }) {
    const { igUserId, token } = ig(cliente);
    const c = await graph("GET", igUserId, token, { fields: "username,name,biography,website,followers_count,follows_count,media_count" });
    return JSON.stringify(c, null, 2);
  }

  async function traerPublicaciones(igUserId, token, { desde, hasta, limite = 50 }) {
    const r = rango(desde, hasta);
    const out = [];
    let after;
    for (let i = 0; i < 10 && out.length < limite; i++) {
      const page = await graph("GET", `${igUserId}/media`, token, { fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count", limit: "50", ...(after ? { after } : {}) });
      let pasoElDesde = false;
      for (const m of page.data || []) {
        const t = Math.floor(Date.parse(m.timestamp) / 1000);
        if (t < r.since) { pasoElDesde = true; continue; }
        if (t <= r.until) out.push(m);
      }
      after = page.paging?.cursors?.after;
      if (pasoElDesde || !page.paging?.next || !after) break;
    }
    return out.slice(0, limite);
  }

  async function listarPublicaciones({ cliente, desde, hasta, limite = 50 }) {
    const { igUserId, token } = ig(cliente);
    const n = Math.min(Math.max(Number(limite) || 50, 1), 100);
    const ms = await traerPublicaciones(igUserId, token, { desde, hasta, limite: n });
    return JSON.stringify(ms.map((m) => ({ ...m, tipo: tipoDe(m) })), null, 2);
  }

  async function insightsMedia(m, token) {
    const tipo = tipoDe(m);
    const { valores, no_disponibles } = await metricas(`${m.id}/insights`, token, tipo === "REEL" ? METRICAS_MEDIA.REEL : METRICAS_MEDIA.OTRO);
    return { tipo, valores, no_disponibles };
  }

  async function insightsPublicacion({ cliente, media_id }) {
    const { token } = ig(cliente);
    if (typeof media_id !== "string" || !/^\d+$/.test(media_id)) throw new ToolError("media_id inválido.");
    const m = await graph("GET", media_id, token, { fields: "id,media_type,media_product_type,permalink,timestamp,like_count,comments_count" });
    return JSON.stringify({ media: m, ...(await insightsMedia(m, token)) }, null, 2);
  }

  async function insightsCuenta({ cliente, desde, hasta }) {
    const { igUserId, token } = ig(cliente);
    const r = limitarRango(rango(desde, hasta));
    const { valores, no_disponibles } = await metricas(`${igUserId}/insights`, token, METRICAS_CUENTA, { period: "day", metric_type: "total_value", since: r.since, until: r.until });
    let seguidores_por_dia = null;
    try {
      const f = await graph("GET", `${igUserId}/insights`, token, { metric: "follower_count", period: "day", since: r.since, until: r.until });
      seguidores_por_dia = (f.data?.[0]?.values || []).map((v) => ({ fecha: String(v.end_time).slice(0, 10), nuevos_netos: v.value }));
    } catch (e) { no_disponibles.follower_count = e.message.slice(0, 160); }
    return JSON.stringify({ periodo: { desde: r.desde, hasta: r.hasta }, metricas: valores, seguidores_por_dia, no_disponibles }, null, 2);
  }

  async function audienciaDatos(igUserId, token) {
    const out = { demografia: {}, horas_activas: null, no_disponibles: {} };
    for (const breakdown of ["age", "gender", "city", "country"]) {
      try {
        const r = await graph("GET", `${igUserId}/insights`, token, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown });
        const res = r.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        out.demografia[breakdown] = Object.fromEntries(res.map((x) => [x.dimension_values.join("/"), x.value]));
      } catch (e) { out.no_disponibles[`demografia_${breakdown}`] = e.message.slice(0, 160); }
    }
    try {
      const r = await graph("GET", `${igUserId}/insights`, token, { metric: "online_followers", period: "lifetime" });
      const acum = {}, cont = {};
      for (const v of r.data?.[0]?.values || []) {
        for (const [h, n] of Object.entries(v.value || {})) { acum[h] = (acum[h] || 0) + n; cont[h] = (cont[h] || 0) + 1; }
      }
      const horas = Object.fromEntries(Object.keys(acum).map((h) => [h, Math.round(acum[h] / cont[h])]));
      out.horas_activas = Object.keys(horas).length ? horas : null;
    } catch (e) { out.no_disponibles.horas_activas = e.message.slice(0, 160); }
    return out;
  }

  async function audiencia({ cliente }) {
    const { igUserId, token } = ig(cliente);
    return JSON.stringify(await audienciaDatos(igUserId, token), null, 2);
  }

  async function benchmarkCompetidor({ cliente, usuario }) {
    const { igUserId, token } = ig(cliente);
    if (typeof usuario !== "string" || !USUARIO_RE.test(usuario)) throw new ToolError("usuario de Instagram inválido.");
    const fields = `business_discovery.username(${usuario}){username,followers_count,media_count,media.limit(25){media_type,media_product_type,like_count,comments_count,timestamp,permalink}}`;
    const r = await graph("GET", igUserId, token, { fields });
    const bd = r.business_discovery;
    const ms = bd?.media?.data || [];
    const interacciones = ms.map((m) => (m.like_count || 0) + (m.comments_count || 0));
    return JSON.stringify({
      usuario: bd?.username, seguidores: bd?.followers_count, publicaciones_totales: bd?.media_count,
      muestra: ms.length, interacciones_prom_por_post: r2(media(interacciones)),
      tasa_interaccion_vs_seguidores: bd?.followers_count ? r2((media(interacciones) / bd.followers_count) * 100) : null,
      por_formato: agrupar(ms.map((m) => ({ tipo: tipoDe(m), alcance: null, interacciones: (m.like_count || 0) + (m.comments_count || 0), guardados: null, compartidos: null, tasa_interaccion: null })), (p) => p.tipo),
      nota: "Solo cuentas profesionales públicas; Meta no expone alcance ni guardados de terceros: es likes + comentarios.",
    }, null, 2);
  }

  /** Orquesta todo el análisis de un período, calcula agregados y guarda el snapshot local. */
  async function recopilar({ cliente, mes, baseline = false }) {
    const dir = checkCliente(cliente);
    const { igUserId, token } = cuenta(cliente);
    let desde, hasta, etiqueta;
    if (baseline) {
      const h = new Date(), d = new Date(Date.now() - 90 * 86400000);
      hasta = h.toISOString().slice(0, 10); desde = d.toISOString().slice(0, 10); etiqueta = `baseline-${hasta}`;
    } else {
      if (typeof mes !== "string" || !MES_RE.test(mes)) throw new ToolError("indicá mes (AAAA-MM) o baseline:true.");
      const [y, m] = mes.split("-").map(Number);
      desde = `${mes}-01`; hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); etiqueta = mes;
      if (Date.parse(desde) > Date.now()) throw new ToolError("ese mes todavía no empezó.");
      if (Date.parse(hasta) > Date.now()) hasta = new Date().toISOString().slice(0, 10);
    }

    const perfil = await graph("GET", igUserId, token, { fields: "username,followers_count,follows_count,media_count" });
    const crudos = await traerPublicaciones(igUserId, token, { desde, hasta, limite: 60 });
    const posts = [];
    const huecos = {};
    for (const m of crudos) {
      const ins = await insightsMedia(m, token);
      const v = ins.valores;
      for (const [k, e] of Object.entries(ins.no_disponibles)) huecos[`${ins.tipo}.${k}`] = e;
      const { dia, hora } = diaHora(m.timestamp, TZ);
      const alcance = v.reach ?? null;
      const interacciones = v.total_interactions ?? ((m.like_count || 0) + (m.comments_count || 0));
      posts.push({
        id: m.id, tipo: ins.tipo, fecha: m.timestamp, dia, hora, permalink: m.permalink,
        caption_inicio: (m.caption || "").split("\n")[0].slice(0, 90),
        caption_largo: (m.caption || "").length, hashtags: ((m.caption || "").match(/#\p{L}[\p{L}\p{N}_]*/gu) || []).length,
        likes: m.like_count ?? v.likes ?? null, comentarios: m.comments_count ?? v.comments ?? null,
        alcance, vistas: v.views ?? null, guardados: v.saved ?? null, compartidos: v.shares ?? null, interacciones,
        tasa_interaccion: alcance > 0 ? r2((interacciones / alcance) * 100) : null,
        retencion_media_seg: v.ig_reels_avg_watch_time != null ? r2(v.ig_reels_avg_watch_time / 1000) : null,
      });
    }

    // Insights de cuenta en tramos de ≤30 días.
    const cuentaPeriodo = { metricas: {}, seguidores_por_dia: [], no_disponibles: {} };
    for (let ini = unix(`${desde}T00:00:00Z`); ini <= unix(`${hasta}T23:59:59Z`); ini += 30 * 86400) {
      const fin = Math.min(ini + 30 * 86400 - 1, unix(`${hasta}T23:59:59Z`));
      const tramo = JSON.parse(await insightsCuenta({ cliente, desde: new Date(ini * 1000).toISOString().slice(0, 10), hasta: new Date(fin * 1000).toISOString().slice(0, 10) }));
      for (const [k, val] of Object.entries(tramo.metricas)) if (typeof val === "number") cuentaPeriodo.metricas[k] = (cuentaPeriodo.metricas[k] || 0) + val;
      cuentaPeriodo.seguidores_por_dia.push(...(tramo.seguidores_por_dia || []));
      Object.assign(cuentaPeriodo.no_disponibles, tramo.no_disponibles);
    }
    const seguidoresNetos = cuentaPeriodo.seguidores_por_dia.reduce((a, d) => a + (d.nuevos_netos || 0), 0);
    const aud = await audienciaDatos(igUserId, token);

    const snapshot = {
      cliente, periodo: { etiqueta, desde, hasta }, generado: new Date().toISOString(), zona_horaria: TZ,
      cuenta: { usuario: perfil.username, seguidores: perfil.followers_count, siguiendo: perfil.follows_count, publicaciones_totales: perfil.media_count },
      cuenta_periodo: { ...cuentaPeriodo, seguidores_netos_periodo: cuentaPeriodo.seguidores_por_dia.length ? seguidoresNetos : null },
      audiencia: aud,
      resumen: resumirPublicaciones(posts),
      publicaciones: posts,
      huecos_de_datos: { ...huecos, ...cuentaPeriodo.no_disponibles, ...aud.no_disponibles },
    };
    const carpeta = path.join(dir, "analisis");
    fs.mkdirSync(carpeta, { recursive: true });
    const archivo = path.join(carpeta, `${etiqueta}.datos.json`);
    fs.writeFileSync(archivo, JSON.stringify(snapshot, null, 2));
    fs.appendFileSync(path.join(dir, "registro-actividad.log"),
      `[${new Date().toISOString().slice(0, 19).replace("T", " ")}] tool=mcp__instagram__recopilar_estadisticas cliente=${cliente} periodo=${etiqueta} publicaciones=${posts.length}\n`);

    const { publicaciones, ...liviano } = snapshot; // el detalle por post queda en el archivo
    return JSON.stringify({ guardado_en: `clientes/${cliente}/analisis/${etiqueta}.datos.json`, ...liviano }, null, 2);
  }

  const rangoProps = { desde: { type: "string", description: "AAAA-MM-DD" }, hasta: { type: "string", description: "AAAA-MM-DD" } };
  return [
    { name: "perfil_cuenta", description: "Seguidores, seguidos, cantidad de publicaciones, bio y sitio de la cuenta de Instagram del cliente. Solo lectura.",
      inputSchema: { type: "object", properties: { cliente: clienteProp }, required: ["cliente"] }, handler: perfilCuenta },
    { name: "listar_publicaciones", description: "Publicaciones de la cuenta en un rango de fechas (tipo, fecha, likes, comentarios, permalink). Solo lectura.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, ...rangoProps, limite: { type: "number" } }, required: ["cliente", "desde", "hasta"] }, handler: listarPublicaciones },
    { name: "insights_publicacion", description: "Métricas de una publicación: alcance, vistas, guardados, compartidos, interacciones y, en reels, retención media. Informa qué métricas Meta no entregó. Solo lectura.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, media_id: { type: "string" } }, required: ["cliente", "media_id"] }, handler: insightsPublicacion },
    { name: "insights_cuenta", description: "Métricas de la cuenta en un rango de hasta 30 días: alcance, vistas, cuentas que interactuaron, interacciones, guardados, compartidos, toques al enlace, seguidores nuevos netos por día. Solo lectura.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, ...rangoProps }, required: ["cliente", "desde", "hasta"] }, handler: insightsCuenta },
    { name: "audiencia", description: "Demografía de seguidores (edad, género, ciudad, país) y horas del día con más seguidores conectados. Requiere 100+ seguidores. Solo lectura.",
      inputSchema: { type: "object", properties: { cliente: clienteProp }, required: ["cliente"] }, handler: audiencia },
    { name: "benchmark_competidor", description: "Métricas públicas de otra cuenta profesional (business discovery): seguidores y likes+comentarios de sus últimas 25 publicaciones. Solo lectura.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, usuario: { type: "string", description: "@usuario del competidor, sin @." } }, required: ["cliente", "usuario"] }, handler: benchmarkCompetidor },
    { name: "recopilar_estadisticas", description: "Análisis completo de un período: perfil, publicaciones con sus insights, métricas de cuenta, audiencia y agregados por formato, día, franja horaria y hashtags. Guarda el snapshot en clientes/<cliente>/analisis/<periodo>.datos.json. Usar mes:'AAAA-MM' (análisis mensual) o baseline:true (últimos 90 días, para cuentas recién dadas de alta). Solo lectura sobre Instagram.",
      inputSchema: { type: "object", properties: { cliente: clienteProp, mes: { type: "string", description: "AAAA-MM" }, baseline: { type: "boolean" } }, required: ["cliente"] }, handler: recopilar },
  ];
}
