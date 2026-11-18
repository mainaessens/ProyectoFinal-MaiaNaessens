import { useCallback, useEffect, useRef, useState } from 'react';
import { api, openSocket } from './api.js';
import Md from './Md.jsx';
import Solicitudes from './Solicitud.jsx';

const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const usd = (n) => (n >= 0.01 ? `US$ ${n.toFixed(2)}` : `US$ ${n.toFixed(4)}`);

// El último modelo elegido se recuerda en el navegador (solo es una preferencia; el servidor valida contra su lista).
const CLAVE_MODELO = 'faro.modelo';
const leerModelo = () => { try { return localStorage.getItem(CLAVE_MODELO) || ''; } catch { return ''; } };
const guardarModelo = (m) => { try { localStorage.setItem(CLAVE_MODELO, m); } catch { /* sin almacenamiento */ } };
const AYUDA_COSTO = 'Estimación de Claude Code a precios de lista de la API, acumulada en la sesión. Con un plan de suscripción consume tu cupo de uso; no es una factura.';

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
export default function Consola({ token, skills, clientes, preCliente, visible, pedido, onCorriendo, onPendientes, onAviso }) {
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
  const [modelo, setModelo] = useState(leerModelo);   // '' = el predeterminado de Claude Code
  const [modelos, setModelos] = useState({ modelos: [], porDefecto: '' });
  const [costo, setCosto] = useState(0);              // costo estimado acumulado de la sesión en curso
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
  useEffect(() => {
    api(token, '/modelos').then((r) => {
      setModelos(r);
      // Un modelo recordado que ya no está permitido se descarta.
      setModelo((m) => (m && !r.modelos.some((x) => x.id === m) ? '' : m));
    }).catch(() => {});
  }, [token]);
  const elegirModelo = (m) => { setModelo(m); guardarModelo(m); };

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
      else if (m.type === 'costo') setCosto(m.total);
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
    setLog([]); setSession(null); setCosto(0);
    send({ type: 'run', skill, cliente: cliente || undefined, args, modelo });
  };
  const responder = (e) => {
    e.preventDefault();
    if (!reply.trim() || !session) return;
    send({ type: 'run', text: reply, sessionId: session, modelo });
    setReply('');
  };
  const responderPedido = (id, decision) => send({ type: 'responder', id, decision });

  // Pedido hecho desde otra vista del panel (ej. «Pedir cambios» en Diseños): se ejecuta una sola vez, ya conectado y sin otra corrida.
  const hecho = useRef(null);
  useEffect(() => {
    if (!pedido || hecho.current === pedido.id || conn !== 'conectado' || running) return;
    if (!skills.some((s) => s.name === pedido.skill)) return;
    hecho.current = pedido.id;
    eligio.current = true;
    setSkill(pedido.skill); setCliente(pedido.cliente); setArgs(pedido.args);
    setLog([]); setSession(null); setCosto(0);
    send({ type: 'run', skill: pedido.skill, cliente: pedido.cliente, args: pedido.args, modelo });
  }, [pedido, conn, running, skills]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = async (id) => {
    try {
      const s = await api(token, `/sesiones/${id}`);
      eligio.current = true;
      setLog([...(s.entradas || []), { k: 'meta', text: '— Sesión retomada: escribile al agente para continuar —' }]);
      setSession(s.id); setPedidos([]); setCosto(Number(s.costo) || 0);
      if (s.modelo) elegirModelo(s.modelo);
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
                <p className="muted small">{s.cliente || 'sin cliente'}{s.skill ? ` · /${s.skill}` : ''}{s.modelo ? ` · ${s.modelo}` : ''} · {fechaCorta(s.actualizada)} · {s.entradas} mensajes{s.costo > 0 ? ` · ${usd(s.costo)}` : ''}</p>
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
        <div className="grid4">
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
          <label title="Cambiar de modelo a mitad de una sesión obliga a reprocesar todo el contexto y encarece ese mensaje: conviene elegirlo al empezar.">Modelo{session && !running && <span className="muted small"> · cambiar acá encarece el próximo mensaje</span>}
            <select value={modelo} onChange={(e) => elegirModelo(e.target.value)} disabled={running}>
              <option value="">{modelos.porDefecto ? `Predeterminado (${modelos.porDefecto})` : 'Predeterminado de Claude Code'}</option>
              {modelos.modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
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
          {costo > 0 && <span className="costo" title={AYUDA_COSTO}>Costo estimado de la sesión: <strong>{usd(costo)}</strong></span>}
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
