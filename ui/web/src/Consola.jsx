import { useEffect, useRef, useState } from 'react';
import { openSocket } from './api.js';
import Md from './Md.jsx';

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

export default function Consola({ token, skills, clientes, preCliente }) {
  const [skill, setSkill] = useState('');
  const [cliente, setCliente] = useState(preCliente || '');
  const [args, setArgs] = useState('');
  const [reply, setReply] = useState('');
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState(null);
  const [conn, setConn] = useState('conectando');
  const ws = useRef(null);
  const end = useRef(null);

  useEffect(() => { setCliente(preCliente || ''); }, [preCliente]);
  useEffect(() => { if (!skill && skills.length) setSkill(skills[0].name); }, [skills, skill]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [log]);

  useEffect(() => {
    const push = (e) => setLog((l) => [...l, ...e]);
    const sock = openSocket(token, (m) => {
      if (m.type === 'start') { setRunning(true); push([{ k: 'user', text: m.prompt }]); }
      else if (m.type === 'claude') {
        if (m.data?.session_id) setSession(m.data.session_id);
        push(entradasDe(m));
      }
      else if (m.type === 'stdout') push([{ k: 'meta', text: m.text }]);
      else if (m.type === 'stderr') push([{ k: 'err', text: m.text }]);
      else if (m.type === 'error') { setRunning(false); push([{ k: 'err', text: m.text }]); }
      else if (m.type === 'done') { setRunning(false); push([{ k: 'meta', text: `Proceso finalizado (código ${m.code})` }]); }
    }, () => setConn('desconectado'));
    sock.onopen = () => setConn('conectado');
    ws.current = sock;
    return () => sock.close();
  }, [token]);

  const send = (payload) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(payload));
  const ejecutar = (e) => {
    e.preventDefault();
    setLog([]); setSession(null);
    send({ type: 'run', skill, cliente: cliente || undefined, args });
  };
  const responder = (e) => {
    e.preventDefault();
    if (!reply.trim() || !session) return;
    send({ type: 'run', text: reply, sessionId: session });
    setReply('');
  };

  const actual = skills.find((s) => s.name === skill);

  return (
    <section className="stack">
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
