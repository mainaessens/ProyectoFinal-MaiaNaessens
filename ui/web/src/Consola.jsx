import { useEffect, useRef, useState } from 'react';
import { openSocket } from './api.js';
import Md from './Md.jsx';
import { leerSesion, guardarSesion, borrarSesion, ultimoCliente } from './sesion.js';

// Convierte un evento stream-json de Claude Code en entradas para el transcript.
function entradasDe(ev) {
  const d = ev.data;
  if (!d) return [];
  if (d.type === 'assistant') {
    return (d.message?.content || []).flatMap((b) => {
      if (b.type === 'text' && b.text?.trim()) return [{ k: 'agent', text: b.text }];
      if (b.type === 'tool_use') {
        const resumen = JSON.stringify(b.input || {}).slice(0, 140);
        return [{ k: 'tool', text: `${b.name} ${resumen}` }];
      }
      return [];
    });
  }
  if (d.type === 'result') {
    const authHint = d.is_error && /authenticate|OAuth|login/i.test(d.result || '')
      ? ' → Iniciá sesión de nuevo abriendo una terminal y ejecutando `claude` (luego /login).' : '';
    return [{ k: d.is_error ? 'err' : 'meta', text: d.is_error ? `Terminó con error: ${d.result || d.subtype}${authHint}` : `Listo · ${d.num_turns ?? '?'} pasos${d.total_cost_usd ? ` · US$ ${d.total_cost_usd.toFixed(3)}` : ''}` }];
  }
  return [];
}

const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '');

/**
 * Consola del agente. App la mantiene SIEMPRE montada (oculta cuando no se está en esa vista), así que su estado
 * (log, sesión, skill, cliente, argumentos) y su WebSocket sobreviven a la navegación por el panel.
 *  - visible:      si la vista del agente está a la vista.
 *  - onCorriendo:  avisa a App si hay un skill corriendo (indicador de la barra lateral).
 *  - onAviso:      avisa a App que un skill terminó mientras la vista estaba oculta.
 */
export default function Consola({ token, skills, clientes, preCliente, visible, onCorriendo, onAviso }) {
  const [skill, setSkill] = useState('');
  const [cliente, setCliente] = useState(() => preCliente || ultimoCliente());
  const [args, setArgs] = useState('');
  const [reply, setReply] = useState('');
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [conn, setConn] = useState('conectando');
  const ws = useRef(null);
  const end = useRef(null);
  const ctx = useRef({ cliente: '', skill: '' }); // cliente y skill de la ejecución actual (para guardar la sesión)
  const visibleRef = useRef(visible);
  const cb = useRef({});
  cb.current = { onCorriendo, onAviso };

  // El cliente elegido en otra vista («Ejecutar skill» de un cliente) se aplica solo si hay uno; navegar sin cliente no lo borra.
  useEffect(() => { if (preCliente && !running) setCliente(preCliente); }, [preCliente]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!skill && skills.length) setSkill(skills[0].name); }, [skills, skill]);
  // Si el cliente recordado ya no existe, se vuelve a «(ninguno)».
  useEffect(() => { if (cliente && clientes.length && !clientes.some((x) => x.slug === cliente)) setCliente(''); }, [clientes, cliente]);
  useEffect(() => {
    visibleRef.current = visible;
    if (visible) end.current?.scrollIntoView({ block: 'end' });
  }, [visible]);
  useEffect(() => { if (visibleRef.current) end.current?.scrollIntoView({ block: 'end' }); }, [log]);
  useEffect(() => { cb.current.onCorriendo?.(running); }, [running]);

  // Sesión anterior de este cliente (recargar la página mata el proceso, pero la conversación se puede retomar con --resume).
  useEffect(() => { setPrevia(leerSesion(cliente)); }, [cliente, session]);

  // Recargar o cerrar la pestaña cancela el skill en curso: se avisa antes.
  useEffect(() => {
    if (!running) return undefined;
    const aviso = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [running]);

  useEffect(() => {
    const push = (e) => setLog((l) => [...l, ...e]);
    const sock = openSocket(token, (m) => {
      if (m.type === 'start') { setRunning(true); push([{ k: 'user', text: m.prompt }]); }
      else if (m.type === 'claude') {
        const id = m.data?.session_id;
        if (id) { setSession(id); guardarSesion(ctx.current.cliente, { id, skill: ctx.current.skill }); }
        push(entradasDe(m));
      }
      else if (m.type === 'stdout') push([{ k: 'meta', text: m.text }]);
      else if (m.type === 'stderr') push([{ k: 'err', text: m.text }]);
      else if (m.type === 'error') { setRunning(false); push([{ k: 'err', text: m.text }]); }
      else if (m.type === 'done') {
        setRunning(false);
        push([{ k: 'meta', text: `Proceso finalizado (código ${m.code})` }]);
        if (!visibleRef.current) cb.current.onAviso?.(true);
      }
    }, () => {
      setConn('desconectado');
      // El servidor cancela la ejecución al perderse la conexión.
      setRunning((r) => {
        if (r) setLog((l) => [...l, { k: 'err', text: 'Se perdió la conexión con el servidor: la ejecución se canceló. Recargá la página para reconectar.' }]);
        return false;
      });
    });
    sock.onopen = () => setConn('conectado');
    ws.current = sock;
    return () => sock.close();
  }, [token]);

  const send = (payload) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(payload));
  const ejecutar = (e) => {
    e.preventDefault();
    ctx.current = { cliente: cliente || '', skill };
    setLog([]); setSession(null);
    send({ type: 'run', skill, cliente: cliente || undefined, args });
  };
  const responder = (e) => {
    e.preventDefault();
    if (!reply.trim() || !session) return;
    send({ type: 'run', text: reply, sessionId: session });
    setReply('');
  };
  const retomar = () => {
    if (!previa) return;
    ctx.current = { cliente: cliente || '', skill: previa.skill };
    if (previa.skill) setSkill(previa.skill);
    setLog([{ k: 'meta', text: `Sesión retomada${previa.skill ? ` (/${previa.skill})` : ''}. El historial anterior no se conserva: escribile al agente para continuar.` }]);
    setSession(previa.id);
  };
  const descartar = () => { borrarSesion(cliente); setPrevia(null); };

  const actual = skills.find((s) => s.name === skill);

  return (
    <section className="stack">
      {previa && !session && !running && (
        <div className="card resume">
          <div>
            <strong>Sesión anterior{cliente ? ` de ${cliente}` : ''}</strong>
            <p className="muted small">{previa.skill ? `/${previa.skill} · ` : ''}{fechaCorta(previa.fecha)}</p>
          </div>
          <div className="row">
            <button type="button" className="ghost" onClick={descartar}>Descartar</button>
            <button type="button" className="primary" onClick={retomar} disabled={conn !== 'conectado'}>Continuar la sesión anterior</button>
          </div>
        </div>
      )}

      <form className="card form" onSubmit={ejecutar}>
        <div className="grid3">
          <label>Skill
            <select value={skill} onChange={(e) => setSkill(e.target.value)} disabled={running}>
              {skills.map((s) => <option key={s.name} value={s.name}>/{s.name}</option>)}
            </select>
          </label>
          <label>Cliente
            <select value={cliente} onChange={(e) => setCliente(e.target.value)} disabled={running}>
              <option value="">(ninguno)</option>
              {clientes.map((c) => <option key={c.slug} value={c.slug}>{c.slug}</option>)}
            </select>
          </label>
          <label>Argumentos
            <input value={args} onChange={(e) => setArgs(e.target.value)} disabled={running}
              placeholder={actual?.argumentHint || 'tema, mes, etc.'} maxLength={500} />
          </label>
        </div>
        {actual && <p className="muted small">{actual.description}</p>}
        <div className="row end">
          <span className={`dot ${conn}`}>{conn}</span>
          {running
            ? <button type="button" className="ghost danger" onClick={() => send({ type: 'cancel' })}>Cancelar</button>
            : <button className="primary" disabled={conn !== 'conectado' || !skill}>Ejecutar</button>}
        </div>
      </form>

      <div className="card transcript">
        {!log.length && <p className="muted">La salida del agente aparece acá. Las acciones sensibles (publicar, crear en bloque, gastar) siguen requiriendo tu OK explícito.</p>}
        {log.map((x, i) => (
          <div key={i} className={`msg ${x.k}`}>
            {x.k === 'agent' ? <Md>{x.text}</Md> : <span>{x.k === 'tool' ? '⚙ ' : x.k === 'user' ? '› ' : ''}{x.text}</span>}
          </div>
        ))}
        {running && <div className="msg meta pulse">trabajando…</div>}
        <div ref={end} />
      </div>

      {session && !running && (
        <form className="row grow" onSubmit={responder}>
          <input value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder="Responder al agente (aprobar, corregir, elegir opción…)" maxLength={4000} />
          <button className="primary" disabled={!reply.trim()}>Enviar</button>
        </form>
      )}
    </section>
  );
}
