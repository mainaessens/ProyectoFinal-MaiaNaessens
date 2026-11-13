import { useCallback, useEffect, useRef, useState } from 'react';
import { api, openSocket } from './api.js';
import Md from './Md.jsx';
import Solicitudes from './Solicitud.jsx';

const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '');

/**
 * Consola del agente. App la mantiene SIEMPRE montada (oculta cuando no se está en esa vista), así que su estado
 * (historial, sesión, skill, cliente, argumentos) y su WebSocket sobreviven a la navegación por el panel.
 *  - visible:      si la vista del agente está a la vista.
 *  - onCorriendo:  avisa a App si hay un skill corriendo.
 *  - onPendientes: avisa a App cuántos pedidos del agente esperan respuesta (preguntas y permisos).
 *  - onAviso:      avisa a App que un skill terminó mientras la vista estaba oculta.
 *
 * El historial lo arma y lo guarda el servidor: se puede abrir una sesión anterior y continuarla (--resume).
 */
export default function Consola({ token, skills, clientes, preCliente, visible, onCorriendo, onPendientes, onAviso }) {
  const [skill, setSkill] = useState('');
  const [cliente, setCliente] = useState(preCliente || '');
  const [args, setArgs] = useState('');
  const [reply, setReply] = useState('');
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [verLista, setVerLista] = useState(false);
  const [conn, setConn] = useState('conectando');
  const ws = useRef(null);
  const end = useRef(null);
  const visibleRef = useRef(visible);
  const eligio = useRef(Boolean(preCliente)); // el operador ya eligió cliente: no se le pisa con el de la última sesión
  const cb = useRef({});
  cb.current = { onCorriendo, onPendientes, onAviso };

  const cargarSesiones = useCallback(async () => {
    try { setSesiones(await api(token, '/sesiones')); } catch { /* el panel sigue funcionando sin la lista */ }
  }, [token]);

  useEffect(() => { if (preCliente && !running) { eligio.current = true; setCliente(preCliente); } }, [preCliente]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!skill && skills.length) setSkill(skills[0].name); }, [skills, skill]);
  // Al abrir el panel, se preselecciona el cliente de la última sesión (si el operador todavía no eligió uno).
  useEffect(() => {
    if (!eligio.current && sesiones.length && sesiones[0].cliente && clientes.some((c) => c.slug === sesiones[0].cliente)) {
      eligio.current = true;
      setCliente(sesiones[0].cliente);
    }
  }, [sesiones, clientes]);
  useEffect(() => { if (cliente && clientes.length && !clientes.some((x) => x.slug === cliente)) setCliente(''); }, [clientes, cliente]);
  useEffect(() => {
    visibleRef.current = visible;
    if (visible) { end.current?.scrollIntoView({ block: 'end' }); cargarSesiones(); }
  }, [visible, cargarSesiones]);
  useEffect(() => { if (visibleRef.current) end.current?.scrollIntoView({ block: 'end' }); }, [log, pedidos]);
  useEffect(() => { cb.current.onCorriendo?.(running); }, [running]);
  useEffect(() => { cb.current.onPendientes?.(pedidos.length); }, [pedidos]);
  useEffect(() => { cargarSesiones(); }, [cargarSesiones]);

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
      if (m.type === 'start') { setRunning(true); setPedidos([]); }
      else if (m.type === 'entradas') push(m.entradas);
      else if (m.type === 'sesion') setSession(m.id);
      else if (m.type === 'solicitud') setPedidos((p) => [...p.filter((x) => x.id !== m.id), m]);
      else if (m.type === 'solicitud_resuelta') setPedidos((p) => p.filter((x) => x.id !== m.id));
      else if (m.type === 'aviso') push([{ k: 'err', text: m.text }]);
      else if (m.type === 'error') { setRunning(false); setPedidos([]); push([{ k: 'err', text: m.text }]); }
      else if (m.type === 'done') {
        setRunning(false); setPedidos([]);
        if (!visibleRef.current) cb.current.onAviso?.(true);
        cargarSesiones();
      }
    }, () => {
      setConn('desconectado');
      // El servidor cancela la ejecución al perderse la conexión.
      setRunning((r) => {
        if (r) setLog((l) => [...l, { k: 'err', text: 'Se perdió la conexión con el servidor: la ejecución se canceló. Recargá la página para reconectar.' }]);
        return false;
      });
      setPedidos([]);
    });
    sock.onopen = () => setConn('conectado');
    ws.current = sock;
    return () => sock.close();
  }, [token, cargarSesiones]);

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
  const responderPedido = (id, decision) => send({ type: 'responder', id, decision });

  const abrir = async (id) => {
    try {
      const s = await api(token, `/sesiones/${id}`);
      eligio.current = true;
      setLog([...(s.entradas || []), { k: 'meta', text: '— Sesión retomada: escribile al agente para continuar —' }]);
      setSession(s.id); setPedidos([]);
      if (s.cliente) setCliente(s.cliente); else setCliente('');
      if (s.skill) setSkill(s.skill);
      setVerLista(false);
    } catch (e) { setLog((l) => [...l, { k: 'err', text: `No se pudo abrir la sesión: ${e.message}` }]); }
  };
  const borrar = async (id) => {
    if (!window.confirm('¿Eliminar esta sesión guardada? No se puede deshacer.')) return;
    try { await api(token, `/sesiones/${id}`, { method: 'DELETE' }); } catch { /* ya no estaba */ }
    if (id === session) setSession(null);
    cargarSesiones();
  };

  const actual = skills.find((s) => s.name === skill);
  const ultima = sesiones.find((s) => !cliente || s.cliente === cliente);
  const mostrables = sesiones.filter((s) => !cliente || s.cliente === cliente).slice(0, 12);

  return (
    <section className="stack">
      {!session && !running && ultima && (
        <div className="card resume">
          <div>
            <strong>Última sesión{ultima.cliente ? ` de ${ultima.cliente}` : ''}</strong>
            <p className="muted small">{ultima.skill ? `/${ultima.skill} · ` : ''}{fechaCorta(ultima.actualizada)} · {ultima.titulo}</p>
          </div>
          <div className="row">
            <button type="button" className="ghost" onClick={() => setVerLista((v) => !v)}>{verLista ? 'Ocultar' : `Sesiones anteriores (${mostrables.length})`}</button>
            <button type="button" className="primary" onClick={() => abrir(ultima.id)} disabled={conn !== 'conectado'}>Continuar la última sesión</button>
          </div>
        </div>
      )}
      {verLista && (
        <div className="card lista-sesiones">
          {mostrables.length === 0 && <p className="muted">No hay sesiones guardadas{cliente ? ` para ${cliente}` : ''}.</p>}
          {mostrables.map((s) => (
            <div key={s.id} className="fila-sesion">
              <div className="grow-1">
                <strong>{s.titulo || '(sin título)'}</strong>
                <p className="muted small">{s.cliente || 'sin cliente'}{s.skill ? ` · /${s.skill}` : ''} · {fechaCorta(s.actualizada)} · {s.entradas} mensajes</p>
              </div>
              <div className="row">
                <button type="button" className="ghost danger" onClick={() => borrar(s.id)} disabled={running}>Eliminar</button>
                <button type="button" className="primary" onClick={() => abrir(s.id)} disabled={running}>Abrir</button>
              </div>
            </div>
          ))}
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
            <select value={cliente} onChange={(e) => { eligio.current = true; setCliente(e.target.value); }} disabled={running}>
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
        {!log.length && <p className="muted">La salida del agente aparece acá. Las preguntas y los permisos que pida el agente los resolvés desde este panel. Las acciones sensibles (publicar, crear en bloque, gastar) siguen requiriendo tu OK explícito.</p>}
        {log.map((x, i) => (
          <div key={i} className={`msg ${x.k}`}>
            {x.k === 'agent' ? <Md>{x.text}</Md> : <span>{x.k === 'tool' ? '⚙ ' : x.k === 'user' ? '› ' : ''}{x.text}</span>}
          </div>
        ))}
        {running && !pedidos.length && <div className="msg meta pulse">trabajando…</div>}
        {running && pedidos.length > 0 && <div className="msg meta pulse">esperando tu respuesta…</div>}
        <div ref={end} />
      </div>

      <Solicitudes pedidos={pedidos} onResponder={responderPedido} />

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
