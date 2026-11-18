import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parsearEnv, cargarEnv } from "./cargar-env.mjs";

test("parsearEnv: comentarios, vacías, comillas y export", () => {
  const vars = parsearEnv(
    [
      "# comentario",
      "",
      "LATE_API_KEY=abc123",
      '  SUPABASE_URL = "https://x.supabase.co" ',
      "export GLIF_API_TOKEN='tok con espacio'",
      "SIN_IGUAL",
      "=sin_clave",
    ].join("\n")
  );
  assert.equal(vars.LATE_API_KEY, "abc123");
  assert.equal(vars.SUPABASE_URL, "https://x.supabase.co");
  assert.equal(vars.GLIF_API_TOKEN, "tok con espacio");
  assert.equal(vars.SIN_IGUAL, undefined);
  assert.equal(vars[""], undefined);
});

test("cargarEnv: el .env pisa el entorno y solo toca sus propias claves", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "env-test-"));
  const archivo = path.join(dir, ".env");
  fs.writeFileSync(archivo, "A=del_env\nB=del_env\n");
  const env = { A: "del_sistema", B: "", D: "intacta" }; // A seteada, B vacía, D no está en el .env
  const res = cargarEnv({ archivo, env });

  assert.equal(env.A, "del_env", "pisa lo que ya estaba seteado");
  assert.equal(env.B, "del_env", "completa lo que estaba vacío");
  assert.equal(env.D, "intacta", "no toca las claves que el .env no define");
  assert.deepEqual(res.cargadas.sort(), ["A", "B"]);
  assert.equal(res.existe, true);
});

test("cargarEnv: sin archivo no falla", () => {
  const env = {};
  const res = cargarEnv({ archivo: path.join(os.tmpdir(), "no-existe-xyz.env"), env });
  assert.equal(res.existe, false);
  assert.deepEqual(res.cargadas, []);
  assert.deepEqual(env, {});
});
