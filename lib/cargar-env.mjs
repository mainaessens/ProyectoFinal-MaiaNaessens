// Cargador de variables de entorno desde un archivo .env, sin dependencias.
//
// Por qué existe: las API keys y config del proyecto se leen de .claude/.env
// (ignorado por git), que es la ÚNICA fuente. Cada clave definida ahí se setea
// en process.env — y si por lo que sea ya existía en el entorno, el .env la pisa.
// Las claves que el .env no define se dejan como estaban.
//
// El archivo .claude/.env NO se versiona (ver .gitignore). La plantilla pública
// es .claude/.env.example.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Raíz de la agencia: un nivel por encima de lib/, salvo override explícito.
const RAIZ =
  process.env.AGENCIA_ROOT ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Parsea el contenido de un .env a un objeto { CLAVE: valor }.
// Soporta comentarios (#), líneas vacías, comillas envolventes y "export CLAVE=...".
export function parsearEnv(texto) {
  const vars = {};
  for (let linea of String(texto).split(/\r?\n/)) {
    linea = linea.trim();
    if (!linea || linea.startsWith("#")) continue;
    if (linea.startsWith("export ")) linea = linea.slice(7).trim();
    const i = linea.indexOf("=");
    if (i === -1) continue;
    const clave = linea.slice(0, i).trim();
    if (!clave) continue;
    let valor = linea.slice(i + 1).trim();
    if (
      valor.length >= 2 &&
      ((valor[0] === '"' && valor[valor.length - 1] === '"') ||
        (valor[0] === "'" && valor[valor.length - 1] === "'"))
    ) {
      valor = valor.slice(1, -1);
    }
    vars[clave] = valor;
  }
  return vars;
}

// Carga .claude/.env (o el archivo indicado) dentro de `env` (process.env por defecto).
// Devuelve { ruta, existe, cargadas } — `cargadas` son las claves efectivamente seteadas.
export function cargarEnv({ archivo, env = process.env } = {}) {
  const ruta = archivo || path.join(RAIZ, ".claude", ".env");
  let texto;
  try {
    texto = fs.readFileSync(ruta, "utf8");
  } catch {
    return { ruta, existe: false, cargadas: [] };
  }
  const vars = parsearEnv(texto);
  const cargadas = [];
  for (const [clave, valor] of Object.entries(vars)) {
    // El .env manda: cada clave definida pisa lo que hubiera en el entorno.
    env[clave] = valor;
    cargadas.push(clave);
  }
  return { ruta, existe: true, cargadas };
}
