#!/usr/bin/env node
// Servidor MCP (stdio, JSON-RPC por líneas) del conector de Instagram. Sin dependencias.
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createPublisher, ToolError } from "./publisher.mjs";
import { cargarEnv } from "../../lib/cargar-env.mjs";

export async function handleMessage(msg, publisher) {
  const { id, method, params } = msg;
  if (id === undefined) return null; // notificaciones: sin respuesta
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

  if (method === "initialize") {
    return ok({ protocolVersion: params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "instagram-publisher", version: "0.1.0" } });
  }
  if (method === "ping") return ok({});
  if (method === "tools/list") {
    return ok({ tools: publisher.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (method === "tools/call") {
    const tool = publisher.tools.find((t) => t.name === params?.name);
    if (!tool) return fail(-32602, `herramienta desconocida: ${params?.name}`);
    try {
      const text = await tool.handler(params.arguments || {});
      return ok({ content: [{ type: "text", text }] });
    } catch (e) {
      const text = e instanceof ToolError ? `BLOQUEADO/ERROR: ${e.message}` : `Error inesperado: ${e.message}`;
      return ok({ content: [{ type: "text", text }], isError: true });
    }
  }
  return fail(-32601, `método no soportado: ${method}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cargarEnv(); // carga tokens desde .claude/.env (el .env pisa el entorno del sistema)
  const agenciaRoot = process.env.AGENCIA_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const publisher = createPublisher({ agenciaRoot });
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const res = await handleMessage(msg, publisher);
    if (res) process.stdout.write(JSON.stringify(res) + "\n");
  });
}
