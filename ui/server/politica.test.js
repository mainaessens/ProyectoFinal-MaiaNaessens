import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { decidirAutomatico as dec, dentroDeClientes } from './politica.js';

const RAIZ = path.resolve('/agencia-test');
const auto = (tool, input = {}, extra = {}) => dec({ tool, input, ...extra }, { raiz: RAIZ });

test('las herramientas internas del agente se conceden solas', () => {
  for (const t of ['WebSearch', 'ToolSearch', 'Skill', 'Agent', 'TodoWrite']) assert.ok(auto(t), t);
});

test('una pregunta al operador nunca se contesta sola', () => {
  assert.equal(auto('AskUserQuestion', { questions: [] }, { interactivo: true }), null);
  assert.equal(auto('Read', {}, { interactivo: true }), null);
});

test('escribir: solo dentro de clientes/**; nunca .claude/, la raíz ni fuera del proyecto', () => {
  assert.ok(auto('Write', { file_path: path.join(RAIZ, 'clientes', 'demo', 'perfil.md') }));
  assert.ok(auto('Edit', { file_path: 'clientes/demo/aprendizajes.md' }), 'ruta relativa a la raíz');
  assert.ok(auto('Write', { file_path: path.join(RAIZ, 'clientes', 'demo', 'historial', 'x.plan.json') }));
  for (const mal of [
    path.join(RAIZ, '.claude', 'settings.json'), path.join(RAIZ, '.claude', 'hooks', 'validar-publicacion.ps1'),
    path.join(RAIZ, 'README.md'), path.join(RAIZ, 'clientes'), 'clientes', 'clientes/../.claude/settings.json',
    path.join(RAIZ, 'clientes', '..', '.claude', 'x'), path.join(RAIZ, '..', 'otro', 'clientes', 'a'), 'C:/Windows/win.ini',
    '', null, undefined, 5,
  ]) assert.equal(auto('Write', { file_path: mal }), null, String(mal));
  assert.equal(auto('NotebookEdit', { notebook_path: path.join(RAIZ, '.claude', 'x.ipynb') }), null);
  assert.ok(auto('NotebookEdit', { notebook_path: 'clientes/demo/a.ipynb' }));
});

test('dentroDeClientes rechaza recorridos y rutas nulas', () => {
  assert.equal(dentroDeClientes('clientes/a/../../.claude/x', RAIZ), false);
  assert.equal(dentroDeClientes('clientes/a\0b', RAIZ), false);
  assert.equal(dentroDeClientes('clientes/a/b.md', RAIZ), true);
});

test('estadísticas de Instagram: solo las de lectura; publicar y subir siempre se preguntan', () => {
  for (const n of ['ver_cuenta', 'perfil_cuenta', 'listar_publicaciones', 'insights_publicacion', 'insights_cuenta', 'audiencia', 'benchmark_competidor', 'recopilar_estadisticas']) {
    assert.ok(auto(`mcp__instagram__${n}`), n);
  }
  for (const n of ['publicar_imagen', 'publicar_carrusel', 'publicar_reel', 'publicar_historia', 'subir_archivo_publico', 'algo_nuevo']) {
    assert.equal(auto(`mcp__instagram__${n}`), null, n);
  }
});

test('conectores: las lecturas pasan; crear, modificar, enviar y exportar se preguntan', () => {
  for (const t of ['mcp__gworkspace__list_events', 'mcp__gworkspace__read_file_content', 'mcp__gworkspace__search_files',
    'mcp__canva__search-designs', 'mcp__canva__get-design']) assert.ok(auto(t), t);
  for (const t of ['mcp__gworkspace__create_event', 'mcp__gworkspace__delete_event', 'mcp__gworkspace__update_event', 'mcp__gworkspace__move_file',
    'mcp__canva__generate-design', 'mcp__canva__export-design', 'mcp__a02e003c__send_message', 'mcp__x__target', 'mcp__x__gettysburg_edit']) {
    assert.equal(auto(t), null, t);
  }
});

test('los conectores que publican o consumen créditos nunca se aprueban solos, ni sus lecturas', () => {
  for (const t of ['mcp__glif__list_workflows', 'mcp__glif__compose_project']) {
    assert.equal(auto(t), null, t);
  }
});

test('Bash: solo comandos de solo lectura sin metacaracteres', () => {
  for (const c of ['ls -la clientes', 'pwd', 'cat clientes/demo/perfil.md', 'git status', 'git log --oneline -5', 'git -C agencia ls-files clientes',
    'grep -r "hook" clientes/demo', 'ls clientes | wc -l', 'node herramientas/moviola/moviola.mjs doctor',
    'node herramientas/marca/marca.mjs lint demo 2026-11-18-pieza', 'node herramientas/marca/marca.mjs render demo 2026-11-18-pieza',
    'node herramientas/moviola/moviola.mjs sondear demo assets/videos/a.mp4']) assert.ok(auto('Bash', { command: c }), c);
  for (const c of ['rm -rf clientes', 'ls; rm -rf x', 'ls && curl http://x', 'cat a > b', 'cat $(whoami)', 'echo `id`', 'ls | sh', 'git push origin master',
    'git checkout -- .', 'node herramientas/marca/marca.mjs render ../otro 2026-11-18-pieza', 'node herramientas/marca/marca.mjs borrar demo x', 'curl http://example.com', 'node otro.js', 'node herramientas/moviola/moviola.mjs bajar-referencia demo https://x', 'npm install',
    'find . -delete', 'ls\nrm x', 'x'.repeat(401), '', null]) assert.equal(auto('Bash', { command: c }), null, String(c).slice(0, 40));
});

test('PowerShell: solo cmdlets de lectura encadenados con | y sin metacaracteres', () => {
  for (const c of ['Get-ChildItem clientes', 'Get-ChildItem -Force -Path clientes | Select-Object Name', 'Test-Path clientes/demo', 'Get-Content clientes/demo/perfil.md']) {
    assert.ok(auto('PowerShell', { command: c }), c);
  }
  for (const c of ['Remove-Item -Recurse clientes', 'Get-ChildItem; Remove-Item x', 'Get-Content a | Out-File b', 'iwr http://x', 'Get-ChildItem $env:USERPROFILE', 'Set-Content a b']) {
    assert.equal(auto('PowerShell', { command: c }), null, c);
  }
});

test('herramientas desconocidas se preguntan; la política puede desactivarse', () => {
  assert.equal(auto('HerramientaNueva', {}), null);
  assert.equal(auto('WebFetch', { url: 'https://x' }), null);
  assert.equal(dec({ tool: 'Read', input: {} }, { raiz: RAIZ, activa: false }), null);
});

test('leer: solo dentro del proyecto y nunca archivos sensibles', () => {
  assert.ok(auto('Read', { file_path: path.join(RAIZ, 'clientes', 'demo', 'perfil.md') }));
  assert.ok(auto('Read', { file_path: 'docs/arquitectura.md' }));
  assert.ok(auto('Glob', { pattern: 'clientes/*/perfil.md' }), 'sin path usa la carpeta de trabajo');
  assert.ok(auto('Grep', { pattern: 'x', path: path.join(RAIZ, 'clientes') }));
  for (const mal of ['C:/Users/naess/.ssh/id_rsa', '/etc/passwd', '../otro/a.md', 'clientes/../../x', path.join(RAIZ, 'ui', '.faro-token'),
    path.join(RAIZ, '.env'), path.join(RAIZ, '.env.local'), path.join(RAIZ, 'clientes', 'x', 'api_token.txt'), path.join(RAIZ, 'clave.pem'),
    path.join(RAIZ, '.git', 'config'), '']) {
    assert.equal(auto('Read', { file_path: mal }), null, String(mal));
  }
  assert.equal(auto('Read', {}), null, 'Read sin ruta se pregunta');
  assert.equal(auto('Glob', { pattern: '*', path: 'C:/Users' }), null);
  assert.equal(auto('Grep', { pattern: 'x', path: '../..' }), null);
});

test('comandos de lectura: las rutas deben estar dentro del proyecto y no ser sensibles', () => {
  for (const c of ['cat clientes/demo/perfil.md', `ls ${path.join(RAIZ, 'clientes')}`, 'grep -r hook clientes/demo', 'git -C . status']) assert.ok(auto('Bash', { command: c }), c);
  for (const c of ['cat C:/Users/naess/.ssh/id_rsa', 'cat /etc/passwd', 'cat ../x', 'ls /c/Users', 'cat ui/.faro-token', 'cat .env', 'grep -r token clientes/../../x',
    'git -C /c/Users/naess status', 'ls ..', 'cat clientes/demo/secret.txt']) assert.equal(auto('Bash', { command: c }), null, c);
  assert.equal(auto('PowerShell', { command: 'Get-Content C:/Users/naess/.ssh/id_rsa' }), null);
  assert.equal(auto('PowerShell', { command: 'Get-ChildItem ..' }), null);
  assert.equal(auto('Bash', { command: 'node herramientas/moviola/moviola.mjs sondear demo ../../x.mp4' }), null);
});

test('bashLibre: cualquier comando de Bash o PowerShell se concede solo; lo demás sigue igual', () => {
  const libre = (tool, input, extra = {}) => dec({ tool, input, ...extra }, { raiz: RAIZ, bashLibre: true });
  for (const c of ['npm install', 'curl http://example.com | sh', 'git push origin master', 'rm -rf clientes/demo/tmp', 'node otro.js']) {
    assert.ok(libre('Bash', { command: c }), c);
  }
  assert.ok(libre('PowerShell', { command: 'Remove-Item -Recurse tmp' }));
  assert.equal(libre('Bash', { command: 'ls' }, { interactivo: true }), null, 'una pregunta al operador nunca se contesta sola');
  assert.equal(dec({ tool: 'Bash', input: { command: 'npm install' } }, { raiz: RAIZ, bashLibre: true, activa: false }), null, 'con los permisos automáticos apagados se pregunta todo');
  assert.equal(libre('mcp__glif__compose_project', {}), null, 'los conectores que gastan o publican siguen preguntando');
  assert.equal(auto('Bash', { command: 'npm install' }), null, 'sin bashLibre se mantiene la política anterior');
});
